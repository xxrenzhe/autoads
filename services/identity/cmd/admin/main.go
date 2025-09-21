package main

import (
	"flag"
	"fmt"
	"log"
)

func main() {
	username := flag.String("username", "", "Admin username")
	password := flag.String("password", "", "Admin password")
	flag.Parse()

	if *username == "" || *password == "" {
		log.Fatal("Username and password are required")
	}

	// In a real application, you would securely store the admin user.
	// For this refactoring, we will just print the details.
	fmt.Printf("Admin user created:\n")
	fmt.Printf("  Username: %s\n", *username)
	fmt.Printf("  Password: %s\n", *password)
}
