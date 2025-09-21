package main

import (
	"fmt"
	"log"
	"net/http"
)

func main() {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Adscenter Service Ready")
	})

	fmt.Println("Starting Adscenter service on port 8086")
	if err := http.ListenAndServe(":8086", nil); err != nil {
		log.Fatal(err)
	}
}
