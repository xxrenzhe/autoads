{ pkgs, ... }: {
  channel = "stable-24.05";
  packages = [
    pkgs.go_1_22
    pkgs.nodejs_20
    pkgs.pnpm
    pkgs.air
    pkgs.gcc
    pkgs.docker
    pkgs.docker-compose
    pkgs.git-filter-repo
    pkgs.gopls
    pkgs.gotools
    pkgs.delve
    pkgs.gh
    (pkgs.google-cloud-sdk.withExtraComponents [
      pkgs.google-cloud-sdk.components.gsutil
      pkgs.google-cloud-sdk.components.gke-gcloud-auth-plugin
      pkgs.google-cloud-sdk.components.cloud-datastore-emulator
      pkgs.google-cloud-sdk.components.cloud_sql_proxy
    ])
  ];
  env = {
    GOPATH = "$PWD/go";
    GOCACHE = "/tmp/go-cache";
    NPM_CONFIG_CACHE = "/tmp/npm-cache";
    PNPM_STORE_DIR = "/tmp/pnpm-store";
  };
  idx = {
    extensions = [
      "golang.go"
      "prisma.prisma"
      "esbenp.prettier-vscode"
      "github.vscode-github-actions"
      "ms-azuretools.vscode-docker"
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
    workspace = {
      onCreate = {
        # Force garbage collection for Nix to free up space
        clean-nix-store = "nix-collect-garbage -d";
        # Reduce disk usage by cleaning docker images
        clean-docker = "docker image prune -a -f";
        # Reduce disk usage by cleaning pnpm store
        clean-pnpm = "pnpm store prune";
        # Reduce disk usage by cleaning go modules
        clean-go = "go mod tidy && go clean -modcache";
      };
      onStart = {
        # Check and install dependencies
        install-deps = "pnpm install --shamefully-hoist=true";
      };
    };
  };
  services = {
    docker = {
      enable = true;
    };
  };
}
