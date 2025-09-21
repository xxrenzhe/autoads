package main

import (
	"fmt"
	"log"
	"net/http"
)

func main() {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Batchopen Service Ready")
	})

	fmt.Println("Starting Batchopen service on port 8085")
	if err := http.ListenAndServe(":8085", nil); err != nil {
		log.Fatal(err)
	}
}
