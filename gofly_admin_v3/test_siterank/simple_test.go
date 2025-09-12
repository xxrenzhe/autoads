package siterank

import (
	"fmt"
	"testing"
)

// Simple tests that don't depend on external modules

func TestSimilarWebMockClient(t *testing.T) {
	client := NewMockSimilarWebClient()
	
	// Test domain validation
	err := client.ValidateDomain("google.com")
	if err != nil {
		t.Errorf("Domain validation failed: %v", err)
	}
	
	// Test domain normalization
	normalized := client.NormalizeDomain("GOOGLE.COM")
	if normalized != "google.com" {
		t.Errorf("Expected 'google.com', got '%s'", normalized)
	}
	
	// Test getting domain rank for known domains
	testCases := []struct {
		domain       string
		expectedRank int
		shouldError  bool
	}{
		{"google.com", 1, false},
		{"facebook.com", 3, false},
		{"example.com", 50000, false},
		{"unknown-domain-12345.com", 0, true},
	}
	
	for _, tc := range testCases {
		data, err := client.GetDomainRank(tc.domain, "world")
		
		if tc.shouldError {
			if err == nil {
				t.Errorf("Expected error for domain '%s', but got none", tc.domain)
			}
		} else {
			if err != nil {
				t.Errorf("GetDomainRank failed for '%s': %v", tc.domain, err)
			} else if data == nil {
				t.Errorf("GetDomainRank returned nil data for '%s'", tc.domain)
			} else if data.GlobalRank == nil || *data.GlobalRank != tc.expectedRank {
				t.Errorf("Expected rank %d for '%s', got %v", tc.expectedRank, tc.domain, data.GlobalRank)
			}
		}
	}
}

func TestPriorityCalculation(t *testing.T) {
	testCases := []struct {
		rank     *int
		expected Priority
	}{
		{intPtr(1000), PriorityHigh},
		{intPtr(10000), PriorityHigh},
		{intPtr(50000), PriorityMedium},
		{intPtr(100000), PriorityMedium},
		{intPtr(500000), PriorityLow},
		{nil, PriorityLow},
	}
	
	for _, tc := range testCases {
		query := &SiteRankQuery{GlobalRank: tc.rank}
		priority := query.CalculatePriority()
		
		if priority != tc.expected {
			t.Errorf("For rank %v, expected priority %s, got %s", tc.rank, tc.expected, priority)
		}
	}
}

func TestSiteRankQueryModel(t *testing.T) {
	query := &SiteRankQuery{
		ID:     "test-id",
		UserID: "user-123",
		Domain: "example.com",
		Status: StatusPending,
		Source: SourceSimilarWeb,
	}
	
	// Test table name
	tableName := query.TableName()
	if tableName != "siterank_queries" {
		t.Errorf("Expected table name 'siterank_queries', got '%s'", tableName)
	}
	
	// Test response conversion
	response := query.ToResponse()
	if response == nil {
		t.Fatal("Response is nil")
	}
	
	if response.ID != query.ID {
		t.Errorf("Expected ID '%s', got '%s'", query.ID, response.ID)
	}
	
	if response.Domain != query.Domain {
		t.Errorf("Expected domain '%s', got '%s'", query.Domain, response.Domain)
	}
	
	if response.Status != query.Status {
		t.Errorf("Expected status '%s', got '%s'", query.Status, response.Status)
	}
}

func TestSimilarWebConfig(t *testing.T) {
	config := DefaultSimilarWebConfig()
	
	if config == nil {
		t.Fatal("Config is nil")
	}
	
	if config.BaseURL == "" {
		t.Error("BaseURL should not be empty")
	}
	
	if config.RateLimit <= 0 {
		t.Error("RateLimit should be positive")
	}
	
	if config.Timeout <= 0 {
		t.Error("Timeout should be positive")
	}
	
	if config.RetryCount < 0 {
		t.Error("RetryCount should not be negative")
	}
}

func TestQueryStatusConstants(t *testing.T) {
	expectedStatuses := []QueryStatus{
		StatusPending,
		StatusRunning,
		StatusCompleted,
		StatusFailed,
		StatusCached,
	}
	
	for _, status := range expectedStatuses {
		if string(status) == "" {
			t.Errorf("Status constant should not be empty: %v", status)
		}
	}
}

func TestPriorityConstants(t *testing.T) {
	expectedPriorities := []Priority{
		PriorityHigh,
		PriorityMedium,
		PriorityLow,
	}
	
	for _, priority := range expectedPriorities {
		if string(priority) == "" {
			t.Errorf("Priority constant should not be empty: %v", priority)
		}
	}
}

func TestDataSourceConstants(t *testing.T) {
	expectedSources := []DataSource{
		SourceSimilarWeb,
		SourceCache,
	}
	
	for _, source := range expectedSources {
		if string(source) == "" {
			t.Errorf("DataSource constant should not be empty: %v", source)
		}
	}
}

// Helper function
func intPtr(i int) *int {
	return &i
}

// Benchmark tests
func BenchmarkPriorityCalculation(b *testing.B) {
	query := &SiteRankQuery{}
	rank := 50000
	query.GlobalRank = &rank
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		query.CalculatePriority()
	}
}

func BenchmarkDomainValidation(b *testing.B) {
	client := NewMockSimilarWebClient()
	domain := "example.com"
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		client.ValidateDomain(domain)
	}
}

func BenchmarkDomainNormalization(b *testing.B) {
	client := NewMockSimilarWebClient()
	domain := "EXAMPLE.COM"
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		client.NormalizeDomain(domain)
	}
}

// Example test to demonstrate usage
func ExampleSiteRankQuery_CalculatePriority() {
	query := &SiteRankQuery{}
	
	// High priority domain (rank <= 10000)
	rank := 5000
	query.GlobalRank = &rank
	priority := query.CalculatePriority()
	fmt.Println(priority)
	
	// Medium priority domain (rank <= 100000)
	rank = 50000
	query.GlobalRank = &rank
	priority = query.CalculatePriority()
	fmt.Println(priority)
	
	// Low priority domain (rank > 100000)
	rank = 500000
	query.GlobalRank = &rank
	priority = query.CalculatePriority()
	fmt.Println(priority)
	
	// Output:
	// High
	// Medium
	// Low
}