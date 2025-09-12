// Package tracing provides some utility functions for tracing functionality.
package tracing

import (
	"math"
	"time"

	"go.opentelemetry.io/otel/trace"

	"gofly-admin-v3/utils/tools/gbinary"
	"gofly-admin-v3/utils/tools/grand"
	"gofly-admin-v3/utils/tools/gtype"
)

var (
	randomInitSequence = int32(grand.Intn(math.MaxInt32))
	sequence           = gtype.NewInt32(randomInitSequence)
)

// NewIDs creates and returns a new trace and span ID.
func NewIDs() (traceID trace.TraceID, spanID trace.SpanID) {
	return NewTraceID(), NewSpanID()
}

// NewTraceID creates and returns a trace ID.
func NewTraceID() (traceID trace.TraceID) {
	var (
		timestampNanoBytes = gbinary.EncodeInt64(time.Now().UnixNano())
		sequenceBytes      = gbinary.EncodeInt32(sequence.Add(1))
		randomBytes        = grand.B(4)
	)
	copy(traceID[:], timestampNanoBytes)
	copy(traceID[8:], sequenceBytes)
	copy(traceID[12:], randomBytes)
	return
}

// NewSpanID creates and returns a span ID.
func NewSpanID() (spanID trace.SpanID) {
	copy(spanID[:], gbinary.EncodeInt64(time.Now().UnixNano()/1e3))
	copy(spanID[4:], grand.B(4))
	return
}
