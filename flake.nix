{
  description = "Development environment for AutoAds SaaS";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config = { allowUnfree = true; };
        };
        devcfg = import ./.idx/dev.nix { inherit pkgs; };
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = devcfg.packages;
        };
      });
}
