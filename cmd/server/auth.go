package main

import (
	"context"
	"crypto"
	"crypto/ecdsa"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/subtle"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
)

const (
	sessionCookie  = "sb_session"
	stateCookie    = "sb_oauth_state"
	sessionTTL     = 30 * 24 * time.Hour
	oauthStateTTL  = 10 * time.Minute
	appleAudience  = "https://appleid.apple.com"
	appleSecretTTL = 5 * time.Minute
)

// provider describes an OpenID Connect identity provider.
type provider struct {
	name         string
	authURL      string
	tokenURL     string
	jwksURL      string
	issuers      []string
	scope        string
	clientID     string
	clientSecret func() (string, error)
}

var (
	appStore  *Store
	providers = map[string]*provider{}

	pendingMu     sync.Mutex
	pendingStates = map[string]pendingState{}

	jwksMu    sync.Mutex
	jwksCache = map[string]jwksEntry{}
)

type pendingState struct {
	provider string
	nonce    string
	expires  time.Time
}

type jwksEntry struct {
	keys    map[string]*rsa.PublicKey
	fetched time.Time
}

// initAuth registers the providers that are configured via environment variables.
func initAuth() {
	if id, secret := os.Getenv("GOOGLE_CLIENT_ID"), os.Getenv("GOOGLE_CLIENT_SECRET"); id != "" && secret != "" {
		providers["google"] = &provider{
			name:         "google",
			authURL:      "https://accounts.google.com/o/oauth2/v2/auth",
			tokenURL:     "https://oauth2.googleapis.com/token",
			jwksURL:      "https://www.googleapis.com/oauth2/v3/certs",
			issuers:      []string{"https://accounts.google.com", "accounts.google.com"},
			scope:        "openid",
			clientID:     id,
			clientSecret: func() (string, error) { return secret, nil },
		}
	}
	team, keyID, clientID := os.Getenv("APPLE_TEAM_ID"), os.Getenv("APPLE_KEY_ID"), os.Getenv("APPLE_CLIENT_ID")
	if team != "" && keyID != "" && clientID != "" {
		key, err := loadApplePrivateKey()
		if err != nil {
			log.Printf("Apple login disabled: %v", err)
		} else {
			providers["apple"] = &provider{
				name:     "apple",
				authURL:  "https://appleid.apple.com/auth/authorize",
				tokenURL: "https://appleid.apple.com/auth/token",
				jwksURL:  "https://appleid.apple.com/auth/keys",
				issuers:  []string{appleAudience},
				// No scope on purpose: we only need the stable user id, not name/email.
				// Without scopes Apple also allows a plain GET callback.
				scope:    "",
				clientID: clientID,
				clientSecret: func() (string, error) {
					return appleClientSecret(key, team, keyID, clientID, time.Now())
				},
			}
		}
	}
	for name := range providers {
		log.Printf("Login provider enabled: %s", name)
	}
}

func loadApplePrivateKey() (*ecdsa.PrivateKey, error) {
	pemData := strings.ReplaceAll(os.Getenv("APPLE_PRIVATE_KEY"), `\n`, "\n")
	if pemData == "" {
		if f := os.Getenv("APPLE_PRIVATE_KEY_FILE"); f != "" {
			b, err := os.ReadFile(f)
			if err != nil {
				return nil, err
			}
			pemData = string(b)
		}
	}
	if pemData == "" {
		return nil, errors.New("APPLE_PRIVATE_KEY or APPLE_PRIVATE_KEY_FILE missing")
	}
	block, _ := pem.Decode([]byte(pemData))
	if block == nil {
		return nil, errors.New("invalid Apple private key PEM")
	}
	k, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	ec, ok := k.(*ecdsa.PrivateKey)
	if !ok {
		return nil, errors.New("Apple private key is not an EC key")
	}
	return ec, nil
}

func b64(b []byte) string { return base64.RawURLEncoding.EncodeToString(b) }

// appleClientSecret builds the ES256 JWT Apple expects as client_secret.
func appleClientSecret(key *ecdsa.PrivateKey, teamID, keyID, clientID string, now time.Time) (string, error) {
	header, _ := json.Marshal(map[string]string{"alg": "ES256", "kid": keyID, "typ": "JWT"})
	claims, _ := json.Marshal(map[string]interface{}{
		"iss": teamID,
		"iat": now.Unix(),
		"exp": now.Add(appleSecretTTL).Unix(),
		"aud": appleAudience,
		"sub": clientID,
	})
	signing := b64(header) + "." + b64(claims)
	digest := sha256.Sum256([]byte(signing))
	r, s, err := ecdsa.Sign(rand.Reader, key, digest[:])
	if err != nil {
		return "", err
	}
	sig := make([]byte, 64)
	r.FillBytes(sig[:32])
	s.FillBytes(sig[32:])
	return signing + "." + b64(sig), nil
}

// --- ID token verification ---

func fetchJWKS(jwksURL string, force bool) (map[string]*rsa.PublicKey, error) {
	jwksMu.Lock()
	defer jwksMu.Unlock()
	if e, ok := jwksCache[jwksURL]; ok && !force && time.Since(e.fetched) < time.Hour {
		return e.keys, nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, jwksURL, nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("jwks: HTTP %d", resp.StatusCode)
	}
	var doc struct {
		Keys []struct {
			Kid string `json:"kid"`
			Kty string `json:"kty"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&doc); err != nil {
		return nil, err
	}
	keys := map[string]*rsa.PublicKey{}
	for _, k := range doc.Keys {
		if k.Kty != "RSA" {
			continue
		}
		n, err1 := base64.RawURLEncoding.DecodeString(k.N)
		e, err2 := base64.RawURLEncoding.DecodeString(k.E)
		if err1 != nil || err2 != nil {
			continue
		}
		keys[k.Kid] = &rsa.PublicKey{N: new(big.Int).SetBytes(n), E: int(new(big.Int).SetBytes(e).Int64())}
	}
	jwksCache[jwksURL] = jwksEntry{keys: keys, fetched: time.Now()}
	return keys, nil
}

// verifyIDToken validates signature (RS256), issuer, audience, expiry and nonce and returns the subject.
func verifyIDToken(p *provider, idToken, nonce string, keyFor func(kid string) (*rsa.PublicKey, error), now time.Time) (string, error) {
	parts := strings.Split(idToken, ".")
	if len(parts) != 3 {
		return "", errors.New("malformed id_token")
	}
	hb, err1 := base64.RawURLEncoding.DecodeString(parts[0])
	cb, err2 := base64.RawURLEncoding.DecodeString(parts[1])
	sig, err3 := base64.RawURLEncoding.DecodeString(parts[2])
	if err1 != nil || err2 != nil || err3 != nil {
		return "", errors.New("malformed id_token")
	}
	var header struct {
		Alg string `json:"alg"`
		Kid string `json:"kid"`
	}
	if err := json.Unmarshal(hb, &header); err != nil || header.Alg != "RS256" {
		return "", errors.New("unsupported id_token algorithm")
	}
	pub, err := keyFor(header.Kid)
	if err != nil {
		return "", err
	}
	digest := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	if err := rsa.VerifyPKCS1v15(pub, crypto.SHA256, digest[:], sig); err != nil {
		return "", errors.New("invalid id_token signature")
	}
	var claims struct {
		Iss   string          `json:"iss"`
		Aud   json.RawMessage `json:"aud"`
		Sub   string          `json:"sub"`
		Exp   float64         `json:"exp"`
		Nonce string          `json:"nonce"`
	}
	if err := json.Unmarshal(cb, &claims); err != nil {
		return "", errors.New("invalid id_token claims")
	}
	issOK := false
	for _, i := range p.issuers {
		if claims.Iss == i {
			issOK = true
		}
	}
	if !issOK {
		return "", errors.New("unexpected id_token issuer")
	}
	var aud []string
	var single string
	if json.Unmarshal(claims.Aud, &single) == nil {
		aud = []string{single}
	} else {
		_ = json.Unmarshal(claims.Aud, &aud)
	}
	audOK := false
	for _, a := range aud {
		if a == p.clientID {
			audOK = true
		}
	}
	if !audOK {
		return "", errors.New("unexpected id_token audience")
	}
	if now.Unix() >= int64(claims.Exp) {
		return "", errors.New("id_token expired")
	}
	if subtle.ConstantTimeCompare([]byte(claims.Nonce), []byte(nonce)) != 1 {
		return "", errors.New("nonce mismatch")
	}
	if claims.Sub == "" {
		return "", errors.New("id_token without subject")
	}
	return claims.Sub, nil
}

func jwksKeyFunc(p *provider) func(string) (*rsa.PublicKey, error) {
	return func(kid string) (*rsa.PublicKey, error) {
		for _, force := range []bool{false, true} {
			keys, err := fetchJWKS(p.jwksURL, force)
			if err != nil {
				return nil, err
			}
			if k, ok := keys[kid]; ok {
				return k, nil
			}
		}
		return nil, errors.New("unknown signing key")
	}
}

// --- HTTP helpers ---

func baseURL(r *http.Request) string {
	if v := strings.TrimRight(os.Getenv("PUBLIC_URL"), "/"); v != "" {
		return v
	}
	scheme := "http"
	if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	return scheme + "://" + r.Host
}

func isSecure(r *http.Request) bool {
	return strings.HasPrefix(baseURL(r), "https://")
}

func setCookie(w http.ResponseWriter, r *http.Request, name, value string, expires time.Time) {
	c := &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     "/",
		HttpOnly: true,
		Secure:   isSecure(r),
		SameSite: http.SameSiteLaxMode,
	}
	if expires.IsZero() {
		c.MaxAge = -1
	} else {
		c.Expires = expires
	}
	http.SetCookie(w, c)
}

// currentUser resolves the logged-in user from the session cookie.
func currentUser(r *http.Request) (User, string, bool) {
	if appStore == nil {
		return User{}, "", false
	}
	c, err := r.Cookie(sessionCookie)
	if err != nil {
		return User{}, "", false
	}
	u, ok := appStore.UserBySession(c.Value)
	return u, c.Value, ok
}

// sameOrigin rejects cross-site state changing requests.
func sameOrigin(r *http.Request) bool {
	o := r.Header.Get("Origin")
	if o == "" {
		return true
	}
	u, err := url.Parse(o)
	return err == nil && u.Host == r.Host
}

func authProvidersHandler(w http.ResponseWriter, r *http.Request) {
	_, hasGoogle := providers["google"]
	_, hasApple := providers["apple"]
	writeJSON(w, http.StatusOK, map[string]bool{"google": hasGoogle, "apple": hasApple})
}

// authRouteHandler serves /api/auth/{provider}/{login|callback}.
func authRouteHandler(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/auth/"), "/"), "/")
	if len(parts) != 2 {
		http.NotFound(w, r)
		return
	}
	p, ok := providers[parts[0]]
	if !ok {
		http.Error(w, "login provider not configured", http.StatusNotFound)
		return
	}
	switch parts[1] {
	case "login":
		oauthLogin(w, r, p)
	case "callback":
		oauthCallback(w, r, p)
	default:
		http.NotFound(w, r)
	}
}

func redirectURI(r *http.Request, p *provider) string {
	return baseURL(r) + "/api/auth/" + p.name + "/callback"
}

func oauthLogin(w http.ResponseWriter, r *http.Request, p *provider) {
	state, nonce := generateRandomString(32), generateRandomString(32)
	pendingMu.Lock()
	now := time.Now()
	for k, v := range pendingStates {
		if now.After(v.expires) {
			delete(pendingStates, k)
		}
	}
	pendingStates[state] = pendingState{provider: p.name, nonce: nonce, expires: now.Add(oauthStateTTL)}
	pendingMu.Unlock()

	setCookie(w, r, stateCookie, state, now.Add(oauthStateTTL))
	q := url.Values{
		"response_type": {"code"},
		"client_id":     {p.clientID},
		"redirect_uri":  {redirectURI(r, p)},
		"state":         {state},
		"nonce":         {nonce},
	}
	if p.scope != "" {
		q.Set("scope", p.scope)
	}
	http.Redirect(w, r, p.authURL+"?"+q.Encode(), http.StatusFound)
}

func loginFailed(w http.ResponseWriter, r *http.Request, msg string, err error) {
	if err != nil {
		log.Printf("login failed: %s: %v", msg, err)
	}
	http.Redirect(w, r, "/?login-info="+urlEncode(msg), http.StatusFound)
}

func oauthCallback(w http.ResponseWriter, r *http.Request, p *provider) {
	setCookie(w, r, stateCookie, "", time.Time{})
	if r.URL.Query().Get("error") != "" {
		loginFailed(w, r, "Login cancelled.", nil)
		return
	}
	state, code := r.URL.Query().Get("state"), r.URL.Query().Get("code")
	c, err := r.Cookie(stateCookie)
	if err != nil || state == "" || code == "" || subtle.ConstantTimeCompare([]byte(c.Value), []byte(state)) != 1 {
		loginFailed(w, r, "Login failed. Please try again.", errors.New("state mismatch"))
		return
	}
	pendingMu.Lock()
	ps, found := pendingStates[state]
	delete(pendingStates, state)
	pendingMu.Unlock()
	if !found || ps.provider != p.name || time.Now().After(ps.expires) {
		loginFailed(w, r, "Login expired. Please try again.", errors.New("unknown state"))
		return
	}

	secret, err := p.clientSecret()
	if err != nil {
		loginFailed(w, r, "Login failed. Please try again.", err)
		return
	}
	form := url.Values{
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"redirect_uri":  {redirectURI(r, p)},
		"client_id":     {p.clientID},
		"client_secret": {secret},
	}
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, p.tokenURL, strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		loginFailed(w, r, "Login failed. Please try again.", err)
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusOK {
		loginFailed(w, r, "Login failed. Please try again.", fmt.Errorf("token endpoint %d: %s", resp.StatusCode, body))
		return
	}
	var tok struct {
		IDToken string `json:"id_token"`
	}
	if err := json.Unmarshal(body, &tok); err != nil || tok.IDToken == "" {
		loginFailed(w, r, "Login failed. Please try again.", errors.New("no id_token"))
		return
	}
	sub, err := verifyIDToken(p, tok.IDToken, ps.nonce, jwksKeyFunc(p), time.Now())
	if err != nil {
		loginFailed(w, r, "Login failed. Please try again.", err)
		return
	}
	user, err := appStore.FindOrCreateUser(p.name, sub)
	if err != nil {
		loginFailed(w, r, "Login failed. Please try again.", err)
		return
	}
	token, exp, err := appStore.CreateSession(user.ID, sessionTTL)
	if err != nil {
		loginFailed(w, r, "Login failed. Please try again.", err)
		return
	}
	setCookie(w, r, sessionCookie, token, exp)
	http.Redirect(w, r, "/", http.StatusFound)
}

func meHandler(w http.ResponseWriter, r *http.Request) {
	u, _, ok := currentUser(r)
	if !ok {
		writeJSON(w, http.StatusOK, map[string]interface{}{"loggedIn": false})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"loggedIn": true, "provider": u.Provider})
}

func logoutHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || !sameOrigin(r) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		return
	}
	if _, tok, ok := currentUser(r); ok {
		appStore.DeleteSession(tok)
	}
	setCookie(w, r, sessionCookie, "", time.Time{})
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// accountHandler deletes the account including all battles and screenshots.
func accountHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete || !sameOrigin(r) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		return
	}
	u, _, ok := currentUser(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not logged in"})
		return
	}
	if err := appStore.DeleteUser(u.ID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not delete account"})
		return
	}
	setCookie(w, r, sessionCookie, "", time.Time{})
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// battlesHandler lists the logged-in user's battles of the retention window.
func battlesHandler(w http.ResponseWriter, r *http.Request) {
	u, _, ok := currentUser(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not logged in"})
		return
	}
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"battles":       appStore.ListBattles(u.ID, battleRetention),
			"retentionDays": int(battleRetention / (24 * time.Hour)),
		})
	case http.MethodDelete:
		if !sameOrigin(r) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
			return
		}
		id := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/battles"), "/")
		if err := appStore.DeleteBattle(u.ID, id); err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}
