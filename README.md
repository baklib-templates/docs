# Baklib Wiki Template

Content synchronized from knowledge base, for Large-scale reusable document content management, like Wiki, Documentation, and content portal.

Knowledge base template deployed by Baklib WIKI.

![Baklib CMS based index theme](./assets/images/theme/index-help-center.png)
![Baklib CMS based page theme](./assets/images/theme/index-docs.png)
![Baklib CMS based page theme](./assets/images/theme/page.png)

## 🧞 Install guide

- The Template install Guide: https://help.baklib.cn/themes/wiki

- The Baklib template install Guide: https://dev.baklib.cn/guide/git

## 开发

```shell
# 安装 npm 包
yarn install
# 执行此命令，可在实时把 src 目录的 js/css 代码编译到 assets 目录
yarn dev
```

> 需要本地开发环境
```shell
# 安装 guard-livereload，浏览器安装 livereload 插件，可实现代码改动，浏览器页面自动刷新
bundle install
bundle exec guard
```

## 编译&发布

```bash
yarn build
```


## 其他

- 按语言自动切换预览图
```bash
# config/settings_schema.json 中使用 ${lang} 变量拼接 项目中预览图路径
"theme_preview_images": [
  "images/schema/${lang}/wiki.png",
  "images/schema/${lang}/index-help-center.png",
  "images/schema/${lang}/index-list.png",
  "images/schema/${lang}/index-docs.png",
  "images/schema/${lang}/page.png"
],
```