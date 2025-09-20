package upload

import "testing"

func TestGetFileTypeAndFilename(t *testing.T) {
    us := GetUploadService()
    ty, err := us.getFileType(".jpg", "image/jpeg")
    if err != nil || ty != FileTypeImage { t.Fatalf("unexpected: %v %v", ty, err) }
    ty, err = us.getFileType(".pdf", "application/pdf")
    if err != nil || ty != FileTypeDoc { t.Fatalf("unexpected: %v %v", ty, err) }
    name := us.generateFilename("a.b.jpg", ".jpg")
    if name == "" || name == "a.b.jpg" { t.Fatalf("bad generated name: %s", name) }
}

