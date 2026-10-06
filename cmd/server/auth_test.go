package main

import (
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func signTestToken(t *testing.T, key *rsa.PrivateKey, claims map[string]interface{}) string {
	t.Helper()
	h, _ := json.Marshal(map[string]string{"alg": "RS256", "kid": "k1"})
	c, _ := json.Marshal(claims)
	signing := b64(h) + "." + b64(c)
	d := sha256.Sum256([]byte(signing))
	sig, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, d[:])
	if err != nil {
		t.Fatal(err)
	}
	return signing + "." + b64(sig)
}

func TestVerifyIDToken(t *testing.T) {
	key, _ := rsa.GenerateKey(rand.Reader, 2048)
	keyFor := func(string) (*rsa.PublicKey, error) { return &key.PublicKey, nil }
	p := &provider{clientID: "cid", issuers: []string{"https://accounts.google.com"}}
	now := time.Now()
	good := map[string]interface{}{"iss": "https://accounts.google.com", "aud": "cid", "sub": "123", "exp": now.Add(time.Hour).Unix(), "nonce": "n"}

	sub, err := verifyIDToken(p, signTestToken(t, key, good), "n", keyFor, now)
	if err != nil || sub != "123" {
		t.Fatalf("valid token rejected: %v %q", err, sub)
	}

	cases := map[string]func(m map[string]interface{}){
		"issuer":   func(m map[string]interface{}) { m["iss"] = "https://evil.example" },
		"audience": func(m map[string]interface{}) { m["aud"] = "other" },
		"expired":  func(m map[string]interface{}) { m["exp"] = now.Add(-time.Hour).Unix() },
		"nonce":    func(m map[string]interface{}) { m["nonce"] = "x" },
	}
	for name, mutate := range cases {
		m := map[string]interface{}{}
		for k, v := range good {
			m[k] = v
		}
		mutate(m)
		if _, err := verifyIDToken(p, signTestToken(t, key, m), "n", keyFor, now); err == nil {
			t.Errorf("%s: expected rejection", name)
		}
	}

	other, _ := rsa.GenerateKey(rand.Reader, 2048)
	if _, err := verifyIDToken(p, signTestToken(t, other, good), "n", keyFor, now); err == nil {
		t.Error("token signed with foreign key accepted")
	}
}

func TestAppleClientSecret(t *testing.T) {
	key, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	jwt, err := appleClientSecret(key, "TEAM", "KEYID", "com.example", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	parts := strings.Split(jwt, ".")
	if len(parts) != 3 {
		t.Fatalf("bad jwt: %s", jwt)
	}
	sigBytes, _ := base64.RawURLEncoding.DecodeString(parts[2])
	d := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	r, s := new(big.Int).SetBytes(sigBytes[:32]), new(big.Int).SetBytes(sigBytes[32:])
	if !ecdsa.Verify(&key.PublicKey, d[:], r, s) {
		t.Fatal("signature does not verify")
	}
}

func TestStoreAccountLifecycle(t *testing.T) {
	dir := t.TempDir()
	results := filepath.Join(dir, "results")
	os.MkdirAll(results, 0755)
	st, err := NewStore(filepath.Join(dir, "users.json"), results)
	if err != nil {
		t.Fatal(err)
	}
	u, _ := st.FindOrCreateUser("google", "sub1")
	again, _ := st.FindOrCreateUser("google", "sub1")
	if u.ID != again.ID {
		t.Fatal("user not reused")
	}
	other, _ := st.FindOrCreateUser("apple", "sub1")

	tok, _, _ := st.CreateSession(u.ID, time.Hour)
	if got, ok := st.UserBySession(tok); !ok || got.ID != u.ID {
		t.Fatal("session lookup failed")
	}

	mk := func(user User, name string, age time.Duration) Battle {
		os.WriteFile(filepath.Join(results, name), []byte("png"), 0644)
		b := Battle{ID: name, UserID: user.ID, Title: name, Image: name, CreatedAt: time.Now().Add(-age)}
		st.AddBattle(b)
		return b
	}
	mk(u, "new.png", time.Hour)
	mk(u, "old.png", 31*24*time.Hour)
	mk(other, "other.png", time.Hour)

	if l := st.ListBattles(u.ID, 30*24*time.Hour); len(l) != 1 || l[0].ID != "new.png" {
		t.Fatalf("history should only show last 30 days, got %+v", l)
	}

	st.Cleanup(30 * 24 * time.Hour)
	if _, err := os.Stat(filepath.Join(results, "old.png")); !os.IsNotExist(err) {
		t.Fatal("expired screenshot not removed")
	}

	if err := st.DeleteUser(u.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(results, "new.png")); !os.IsNotExist(err) {
		t.Fatal("screenshot survived account deletion")
	}
	if _, err := os.Stat(filepath.Join(results, "other.png")); err != nil {
		t.Fatal("other user's screenshot was removed")
	}
	if _, ok := st.UserBySession(tok); ok {
		t.Fatal("session survived account deletion")
	}
	if len(st.ListBattles(other.ID, time.Hour*24*30)) != 1 {
		t.Fatal("other user's battles affected")
	}

	// persisted state reloads without the deleted user
	re, _ := NewStore(filepath.Join(dir, "users.json"), results)
	if len(re.data.Users) != 1 || len(re.data.Battles) != 1 {
		t.Fatalf("unexpected persisted data: %+v", re.data)
	}
}

func TestDeleteBattleOwnership(t *testing.T) {
	dir := t.TempDir()
	st, _ := NewStore(filepath.Join(dir, "users.json"), dir)
	st.AddBattle(Battle{ID: "b1", UserID: "alice", CreatedAt: time.Now()})
	if err := st.DeleteBattle("mallory", "b1"); err == nil {
		t.Fatal("deleted foreign battle")
	}
	if err := st.DeleteBattle("alice", "b1"); err != nil {
		t.Fatal(err)
	}
}
