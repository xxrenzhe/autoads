{ pkgs, ... }: {
  channel = "stable-24.05"; 
  packages = [
    pkgs.go_1_22
    pkgs.nodejs_20
    pkgs.air
  ];
  env = {};
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
          port = 3000;
          label = "Frontend";
        };
      };
    };
  };
}
