package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"
)

// User is an optional account. Only the identity provider and its stable
// subject id are stored - no name, email or profile data.
type User struct {
	ID        string    `json:"id"`
	Provider  string    `json:"provider"`
	Sub       string    `json:"sub"`
	CreatedAt time.Time `json:"created_at"`
}

// Session maps a hashed cookie token to a user.
type Session struct {
	TokenHash string    `json:"token_hash"`
	UserID    string    `json:"user_id"`
	Expires   time.Time `json:"expires"`
}

// BattleItem is one ranked entry of a saved battle.
type BattleItem struct {
	Rank int    `json:"rank"`
	Name string `json:"name"`
}

// Battle is a saved result of a logged-in user.
type Battle struct {
	ID         string       `json:"id"`
	UserID     string       `json:"user_id"`
	Title      string       `json:"title"`
	CoverImage string       `json:"cover_image,omitempty"`
	Items      []BattleItem `json:"items"`
	Image      string       `json:"image"` // file name inside the results dir
	CreatedAt  time.Time    `json:"created_at"`
}

type storeData struct {
	Users    []User    `json:"users"`
	Sessions []Session `json:"sessions"`
	Battles  []Battle  `json:"battles"`
}

// Store is a tiny JSON-file backed persistence layer.
type Store struct {
	mu         sync.Mutex
	path       string
	resultsDir string
	data       storeData
}

func NewStore(path, resultsDir string) (*Store, error) {
	s := &Store{path: path, resultsDir: resultsDir}
	b, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return s, nil
		}
		return nil, err
	}
	if err := json.Unmarshal(b, &s.data); err != nil {
		return nil, err
	}
	return s, nil
}

// save must be called with s.mu held.
func (s *Store) save() error {
	b, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(s.path), 0755); err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, b, 0600); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}

func hashToken(t string) string {
	h := sha256.Sum256([]byte(t))
	return hex.EncodeToString(h[:])
}

// removeImage deletes a generated result image; only plain file names are accepted.
func (s *Store) removeImage(name string) {
	if name == "" || name != filepath.Base(name) {
		return
	}
	_ = os.Remove(filepath.Join(s.resultsDir, name))
}

// FindOrCreateUser returns the user for (provider, sub), creating it if needed.
func (s *Store) FindOrCreateUser(provider, sub string) (User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, u := range s.data.Users {
		if u.Provider == provider && u.Sub == sub {
			return u, nil
		}
	}
	u := User{ID: generateRandomString(32), Provider: provider, Sub: sub, CreatedAt: time.Now()}
	s.data.Users = append(s.data.Users, u)
	return u, s.save()
}

// CreateSession creates a session and returns the raw cookie token.
func (s *Store) CreateSession(userID string, ttl time.Duration) (string, time.Time, error) {
	token := generateRandomString(48)
	exp := time.Now().Add(ttl)
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data.Sessions = append(s.data.Sessions, Session{TokenHash: hashToken(token), UserID: userID, Expires: exp})
	return token, exp, s.save()
}

// UserBySession resolves a raw cookie token to its user.
func (s *Store) UserBySession(token string) (User, bool) {
	if token == "" {
		return User{}, false
	}
	h := hashToken(token)
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, sess := range s.data.Sessions {
		if sess.TokenHash == h && time.Now().Before(sess.Expires) {
			for _, u := range s.data.Users {
				if u.ID == sess.UserID {
					return u, true
				}
			}
		}
	}
	return User{}, false
}

func (s *Store) DeleteSession(token string) {
	h := hashToken(token)
	s.mu.Lock()
	defer s.mu.Unlock()
	kept := s.data.Sessions[:0]
	for _, sess := range s.data.Sessions {
		if sess.TokenHash != h {
			kept = append(kept, sess)
		}
	}
	s.data.Sessions = kept
	_ = s.save()
}

func (s *Store) AddBattle(b Battle) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data.Battles = append(s.data.Battles, b)
	return s.save()
}

// ListBattles returns the user's battles newer than maxAge, newest first.
func (s *Store) ListBattles(userID string, maxAge time.Duration) []Battle {
	cutoff := time.Now().Add(-maxAge)
	s.mu.Lock()
	defer s.mu.Unlock()
	out := []Battle{}
	for _, b := range s.data.Battles {
		if b.UserID == userID && b.CreatedAt.After(cutoff) {
			out = append(out, b)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out
}

var errNotFound = errors.New("not found")

// DeleteBattle removes one battle (and its screenshot) owned by userID.
func (s *Store) DeleteBattle(userID, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, b := range s.data.Battles {
		if b.ID == id && b.UserID == userID {
			s.removeImage(b.Image)
			s.data.Battles = append(s.data.Battles[:i], s.data.Battles[i+1:]...)
			return s.save()
		}
	}
	return errNotFound
}

// DeleteUser removes the account together with its sessions, battles and screenshots.
func (s *Store) DeleteUser(userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	users := s.data.Users[:0]
	for _, u := range s.data.Users {
		if u.ID != userID {
			users = append(users, u)
		}
	}
	s.data.Users = users
	sessions := s.data.Sessions[:0]
	for _, sess := range s.data.Sessions {
		if sess.UserID != userID {
			sessions = append(sessions, sess)
		}
	}
	s.data.Sessions = sessions
	battles := s.data.Battles[:0]
	for _, b := range s.data.Battles {
		if b.UserID == userID {
			s.removeImage(b.Image)
		} else {
			battles = append(battles, b)
		}
	}
	s.data.Battles = battles
	return s.save()
}

// Cleanup drops expired sessions and battles older than maxAge (with their screenshots).
func (s *Store) Cleanup(maxAge time.Duration) {
	now := time.Now()
	cutoff := now.Add(-maxAge)
	s.mu.Lock()
	defer s.mu.Unlock()
	sessions := s.data.Sessions[:0]
	for _, sess := range s.data.Sessions {
		if now.Before(sess.Expires) {
			sessions = append(sessions, sess)
		}
	}
	s.data.Sessions = sessions
	battles := s.data.Battles[:0]
	for _, b := range s.data.Battles {
		if b.CreatedAt.Before(cutoff) {
			s.removeImage(b.Image)
		} else {
			battles = append(battles, b)
		}
	}
	s.data.Battles = battles
	_ = s.save()
}
