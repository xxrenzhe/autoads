严格遵循如下约束条件：
1. 遵循KISS简单实用的原则，不要过度设计
2. 借助Context7 MCP获取最新的技术文档，确保技术实现的准确性和稳定性
3. 每次更新后，都自动提交git commit，便于后续回滚

背景知识，在设计时需要考虑，不要违反：
1）部署流程：代码部署发布分2步，第一步：利用Github action生成不同环境的docker镜像；第二步，手动在ClawCloud上配置镜像拉取并部署
- 代码推送到main分支，触发preview环境docker镜像构建：标注 docker image tag 为 ghcr.io/xxrenzhe/autoads:preview-latest
- 代码推送带production分支，触发production环境docker镜像构建：标注 docker image tag 为 ghcr.io/xxrenzhe/autoads:prod-latest
- 当production分支打了tag（如v3.0.0），则触发production环境docker镜像构建：标注 docker image tag 为 ghcr.io/xxrenzhe/autoads:prod-[tag]
- 当前镜像构建使用的是：Dockerfile.standalone
2）不同环境的域名
- 测试环境域名：localhost
- 预发环境域名：urlchecker.dev，容器内部域名是 autoads-preview-xxx-xxx:3000
- 生成环境域名：autoads.dev，容器内部域名是 autoads-prod-xxx-xxx:3000
3）301强制跳转（已在DNS解析层面实现，业务内部无需实现）
- 预发环境，用户访问 https://urlchecker.dev 会301跳转到 https://www.urlchecker.dev
- 生产环境，用户访问 https://autoads.dev 会301跳转到 https://www.autoads.dev
4）预发/生产环境核心环境变量
- NODE_ENV=production
- NEXT_PUBLIC_DOMAIN=urlchecker.dev
- NEXT_PUBLIC_DEPLOYMENT_ENV=preview/production
- DATABASE_URL=mysql://root:jtl85fn8@dbprovider.sg-members-1.clawcloudrun.com:30354
- REDIS_URL=redis://default:9xdjb8nf@dbprovider.sg-members-1.clawcloudrun.com:32284
- AUTH_SECRET=85674018a64071a1f65a376d45a522dec78495cae7f5f1516febf8a4d51ff834
- AUTH_URL=https://www.urlchecker.dev
- AUTH_GOOGLE_ID=1007142410985-4945m48srrp056kp0q5n0e5he8omrdol.apps.googleusercontent.com
- AUTH_GOOGLE_SECRET=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
- SIMILARWEB_API_URL=https://data.similarweb.com/api/v1/data
5）预发/生产环境的容器配置：2C4G
6）用户通过Google OAuth一键登录或邮箱注册登录进入网站，使用网站的功能；管理员通过单独的管理URL通过账号密码登录，进入后台管理系统；两套登录系统独立，互不影响
