
package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthzHandler(t *testing.T) {
	req, err := http.NewRequest("GET", "/healthz", nil)
	if err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(healthzHandler)

	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v",
			status, http.StatusOK)
	}

	expected := `OK`
	if rr.Body.String() != expected {
		t.Errorf("handler returned unexpected body: got %v want %v",
			rr.Body.String(), expected)
	}
}

func TestSiterankHandler(t *testing.T) {
	// For this test, we are assuming the Genkit server is not running,
	// so the AI analysis part will fail. We expect the handler to return an error.
	// This tests the error handling path of our handler.

	req, err := http.NewRequest("GET", "/siterank", nil)
	if err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(siterankHandler)

	handler.ServeHTTP(rr, req)

	// We expect an internal server error because the Genkit service is not available.
	if status := rr.Code; status != http.StatusInternalServerError {
		t.Errorf("handler returned wrong status code: got %v want %v",
			status, http.StatusInternalServerError)
	}

	// Now, let's test the successful path by mocking the AI analyzer.
	// We can't directly mock the function here without more complex dependency injection.
	// However, if we were to refactor the handler to accept an interface for the AI analyzer,
	// we could easily test the success case.

	// For now, this test confirms our error handling works.
}
