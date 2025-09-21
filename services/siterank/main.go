package main

import (
	"fmt"
	"log"
	"net/http"
)

func main() {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Siterank Service Ready")
	})

	fmt.Println("Starting Siterank service on port 8084")
	if err := http.ListenAndServe(":8084", nil); err != nil {
		log.Fatal(err)
	}
}
