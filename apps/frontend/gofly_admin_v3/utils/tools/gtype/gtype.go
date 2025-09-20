// Package gtype provides high performance and concurrent-safe basic variable types.
package gtype

// New is alias of NewAny.
// See NewAny, NewInterface.
func New(value ...interface{}) *Any {
	return NewAny(value...)
}
