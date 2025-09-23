项目重构指令
1.仔细阅读 docs/ProductRefactoring.md 和 docs/productrefactoring-v2 目录下的所有文档
2.请自行访问GCP和Firebase并修改更新，访问方式见secrets目录下的json密钥文件
3.优先访问Secret Manager，获得所有的环境变量
4.若遇到不清楚的地方，或需要申请网络访问权限的，请向我申请
5.完成阶段性的功能迭代后，及时进行功能测试，确保功能正常，且符合预期
6.完成阶段性的功能迭代后，及时编译对应服务镜像，确保构建成功
7.完成阶段性的功能迭代后，及时更新进展文档，保存进展

重要信息：
1.GCP服务账号：codex-dev@gen-lang-client-0944935873.iam.gserviceaccount.com
2.Firebase服务账号：firebase-adminsdk-fbsvc@gen-lang-client-0944935873.iam.gserviceaccount.com
3.GCP Project ID：gen-lang-client-0944935873
4.Cloud Run部署地区：asia-northeast1
5.Cloud SQL数据库：数据库实例autoads，数据库autoads_db，通过VPC Connector进行内网访问数据库