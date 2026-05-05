import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = ['item'];
  static classes = ['active'];

  connect() {
    // 初始化高亮
    this.#updateActiveItem();

    // 点击时高亮
    this.itemTargets.forEach(item => {
      item.addEventListener('click', (e) => {
        this.itemTargets.forEach(i => {
          i.classList.remove(this.activeClass);
        });
        item.classList.add(this.activeClass);
      });
    });

    // 滚动到选中的菜单项
    if (this.activeDom) {
      const rect = this.activeDom.getBoundingClientRect();
      const offsetTop = rect.top - (this.element.parentElement.offsetHeight / 3)
      this.element.parentElement.scrollTo({
        top: offsetTop,
        behavior: 'instant'
      });
    }
  }

  disconnect() {
    if (this.setTimeout) {
      clearTimeout(this.setTimeout);
    }
  }

  // 更新激活状态的菜单项
  #updateActiveItem() {
    // console.log('change', window.location.pathname)
    this.itemTargets.forEach(item => {
      let link;
      if(item.tagName === 'SUMMARY') {
        link = item.querySelector('a');
      } else {
        link = item;
      }
      if (link && link.getAttribute('href') === window.location.pathname) {
        item.classList.add(this.activeClass);
        this.activeDom = item;
        // 展开所有父级 details
        let parent = item.closest('details');
        while (parent) {
          parent.setAttribute('open', '');
          parent = parent.parentElement.closest('details');
        }
      } else {
        item.classList.remove(this.activeClass);
      }
    });
  }
}