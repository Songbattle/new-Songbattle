package main

import "testing"

func TestURLEncode(t *testing.T) {
    s := "a b+c"
    got := urlEncode(s)
    want := "a%20b+c"
    if got != want {
        t.Fatalf("urlEncode: got %q, want %q", got, want)
    }
}

func TestUrlEncodeFormNonEmpty(t *testing.T) {
    m := map[string]string{"a": "1 2", "b": "x"}
    got := urlEncodeForm(m)
    if got == "" {
        t.Fatalf("urlEncodeForm returned empty string")
    }
}
