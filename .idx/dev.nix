# .idx/dev.nix
{ pkgs, ... }: {
  channel = "stable-24.05"; 

  packages = [
    pkgs.go_1_22  # 确保 Go 环境可用
    pkgs.nodejs_20 # 确保 Node.js 环境可用
    pkgs.air       # 一个 Go 实时重载工具，修改后端代码后自动重启
  ];

  env = {};
  idx = {
    extensions = [
      "golang.go", # 推荐安装 Go 插件
      "prisma.prisma", # Prisma 插件
      "esbenp.prettier-vscode" # Prettier 插件
    ];

    previews = {
      enable = true; # 开启预览功能
      previews = [
        {
          # 当3000端口被监听时，自动打开一个预览标签页
          port = 3000;
          label = "Frontend"; # 预览标签的名称
          # onPreview = "npm --prefix apps/frontend install"; # 可选：在预览启动前运行命令
        }
      ];
    };
  };
}
