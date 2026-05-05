import { Application } from "@hotwired/stimulus"
import TocController from "./toc_controller"
import ImagesViewerController from "./images_viewer_controller"
import NavTreeController from "./nav_tree_controller"
import TurboNavTreeController from "./turbo_nav_tree_controller"
import ThemeController from "./theme_controller"
import Clipboard from './clipboard_controller'
import ScrollToController from "./scroll_to_controller"
// import ScrollspyController from "./scrollspy_controller"
import LinkTargetController from "./link_target_controller"
import AiSearchCompletionController from './ai_search_completion_controller'
import CopyPageController from "./copy_page_controller"
import PageToolsController from "./page_tools_controller"
import HeaderSearchController from "./header_search_controller"

if (!window.Stimulus) {
  window.Stimulus = Application.start()
}
const application = window.Stimulus

application.register('toc', TocController)
application.register('images-viewer', ImagesViewerController)
application.register('nav-tree', NavTreeController)
application.register('turbo-nav-tree', TurboNavTreeController)
application.register('theme', ThemeController)
application.register('clipboard', Clipboard)
application.register("scroll-to", ScrollToController)
// application.register("scrollspy", ScrollspyController)
application.register('link-target', LinkTargetController)
application.register('ai-search', AiSearchCompletionController)
application.register("copy-page", CopyPageController)
application.register("page-tools", PageToolsController)
application.register("header-search", HeaderSearchController)
