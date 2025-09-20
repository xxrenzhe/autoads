package gtrace

import (
	"net/http"
	"strings"

	"gofly-admin-v3/utils/tools/gstr"

	"gofly-admin-v3/utils/tools/gcompress"
)

// SafeContentForHttp cuts and returns given content by `MaxContentLogSize`.
// It appends string `...` to the tail of the result if the content size is greater than `MaxContentLogSize`.
func SafeContentForHttp(data []byte, header http.Header) (string, error) {
	var err error
	if gzipAccepted(header) {
		if data, err = gcompress.UnGzip(data); err != nil {
			return string(data), err
		}
	}

	return SafeContent(data), nil
}

// SafeContent cuts and returns given content by `MaxContentLogSize`.
// It appends string `...` to the tail of the result if the content size is greater than `MaxContentLogSize`.
func SafeContent(data []byte) string {
	content := string(data)
	if gstr.LenRune(content) > MaxContentLogSize() {
		content = gstr.StrLimitRune(content, MaxContentLogSize(), "...")
	}

	return content
}

// gzipAccepted returns whether the client will accept gzip-encoded content.
func gzipAccepted(header http.Header) bool {
	a := header.Get("Content-Encoding")
	parts := strings.Split(a, ",")
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "gzip" || strings.HasPrefix(part, "gzip;") {
			return true
		}
	}

	return false
}
