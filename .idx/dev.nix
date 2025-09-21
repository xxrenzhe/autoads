{ pkgs, ... }: {
  channel = "stable-24.05";
  packages = [
    pkgs.go_1_22
    pkgs.nodejs_20
    pkgs.air
    pkgs.gcc
    pkgs.docker
    pkgs.docker-compose
    pkgs.git-filter-repo
  ];
  env = {
    GOPATH = "$PWD/go";
  };
  idx = {
    extensions = [
      "golang.go"
      "prisma.prisma"
      "esbenp.prettier-vscode"
    ];
    previews = {
      enable = true;
      previews = {
        frontend = {
          command = [
            "npm"
            "run"
            "dev"
            "--"
            "--port"
            "$PORT"
            "--hostname"
            "0.0.0.0"
          ];
          manager = "web";
          cwd = "apps/frontend";
        };
      };
    };
  };
  # Correctly placed services block at the top level
  services = {
    docker = {
      enable = true;
    };
  };
}
