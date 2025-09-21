package main

import (
	"fmt"
	"log"
	"net/http"
)

func main() {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Workflow Service Ready")
	})

	fmt.Println("Starting Workflow service on port 8087")
	if err := http.ListenAndServe(":8087", nil); err != nil {
		log.Fatal(err)
	}
}
