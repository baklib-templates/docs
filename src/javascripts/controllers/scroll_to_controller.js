import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  connect(){
    this.scroller = new VanillaScroll()
  }

  scrollToY(e){
    const targetY = e.target.dataset.scrollToY
    if(!targetY){
      console.warn('[scroll-to] data-scroll-to-y is missing')
    }else{
      this.scroller.scrollToY(parseInt(targetY))
    }
  }
}

// 以下代码复制自
// https://github.com/ederssouza/vanillajs-scrollspy/blob/master/src/index.js

export class VanillaScroll {
  constructor(speed = 2000, easing = 'easeOutSine', scrollElement = null) {
    this.speed = speed;
    this.easing = easing;
    this.scrollElement = scrollElement;
    this.requestAnimFrame = window.requestAnimationFrame
      || window.webkitRequestAnimationFrame
      || window.mozRequestAnimationFrame
      || fncAnimation
  }

  scrollToY(targetY = 0) {
    const scrollTargetY = targetY;
    const scrollY = this.scrollElement ? this.scrollElement.scrollTop : (window.scrollY || document.documentElement.scrollTop);
    const time = Math.max(0.1, Math.min(Math.abs(scrollY - scrollTargetY) / this.speed, 0.8));
    let currentTime = 0;
    // console.log('scrollToY', scrollTargetY, this.speed)
    const easingEquations = {
      easeOutSine(pos) {
        return Math.sin(pos * (Math.PI / 2));
      },

      easeInOutSine(pos) {
        return (-0.5 * (Math.cos(Math.PI * pos) - 1));
      },

      easeInOutQuint(pos) {
        /* eslint-disable-next-line */
        if ((pos /= 0.5) < 1) {
          return 0.5 * (pos ** 5);
        }
        return 0.5 * (((pos - 2) ** 5) + 2);
      },
    };

    const tick = () => {
      currentTime += 1 / 60;
      const p = currentTime / time;
      const t = easingEquations[this.easing](p);

      if (p < 1) {
        (window.requestAnimationFrame
          || window.webkitRequestAnimationFrame
          || window.mozRequestAnimationFrame
          || this.fncAnimation)(tick)

        if (this.scrollElement) {
          this.scrollElement.scrollTop = scrollY + ((scrollTargetY - scrollY) * t);
        } else {
          window.scrollTo(0, scrollY + ((scrollTargetY - scrollY) * t));
        }
        return;
      }

      if (this.scrollElement) {
        this.scrollElement.scrollTop = scrollTargetY;
      } else {
        window.scrollTo(0, scrollTargetY);
      }
    };

    tick();
  }

  fncAnimation = (callback) => {
    window.setTimeout(callback, 1000 / 60);
    return callback;
  };
}
