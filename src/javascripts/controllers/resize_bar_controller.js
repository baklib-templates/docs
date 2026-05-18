import { Controller } from "@hotwired/stimulus"

let resizeEventTimer = null;

function getPathTo(element) {
  if (element.tagName == 'HTML')
      return '/HTML[1]';
  if (element===document.body)
      return '/HTML[1]/BODY[1]';

  var ix= 0;
  var siblings= element.parentNode.childNodes;
  for (var i= 0; i<siblings.length; i++) {
      var sibling= siblings[i];
      if (sibling===element)
          return getPathTo(element.parentNode)+'/'+element.tagName+'['+(ix+1)+']';
      if (sibling.nodeType===1 && sibling.tagName===element.tagName)
          ix++;
  }
}

export default class extends Controller {
  static targets = ['bar', 'target']
  static classes = ['dragging']
  static values = {
    'maxSize': { type: Number, default: 600 },
    'minSize': { type: Number, default: 120 },
    'key': String,
    'remember': { type: Boolean, default: false },
    'direction': { type: String, default: 'right' }, // 'right' or 'left'
    'cssVar': String
  }

  initialize(){
    this.startDrag = this.startDrag.bind(this)
    this.drag = this.drag.bind(this)
    this.dragEnd = this.dragEnd.bind(this)
  }

  connect() {
    this.barTarget.addEventListener('mousedown', this.startDrag)
  }

  disconnect(){
    this.barTarget.removeEventListener('mousedown', this.startDrag)
  }

  targetTargetConnected(target){
    setTimeout(() => {
      let rawSize = null;
      if(this.cachedSize) {
        rawSize = Number(this.cachedSize);
      }else{
        rawSize = target.getBoundingClientRect().width;
      }

      if(!Number.isFinite(rawSize)) return;

      const clamped = Math.max(this.minSize, Math.min(this.maxSize, Math.round(rawSize)));
      this.size = clamped
    }, 1);
  }

  get minSize(){
    return this.minSizeValue
  }

  get maxSize(){
    return this.maxSizeValue
  }

  get size(){
    return Math.round(this.targetTarget.getBoundingClientRect().width)
  }

  set size(v){
    const size = Math.max(this.minSize, Math.min(this.maxSize, Math.round(v)))
    this.cachedSize = size
    this.targetTarget.style.flex = `0 0 ${size}px`
    this.targetTarget.style.width = `${size}px`
    this.targetTarget.style.minWidth = `${size}px`

    if (this.hasCssVarValue) {
      document.documentElement.style.setProperty(this.cssVarValue, `${size}px`);
    }

    clearTimeout(resizeEventTimer);
    resizeEventTimer = setTimeout(() => {
      this.emitResize(size)
    }, 16);
  }

  emitResize(size) {
    this.dispatch("resize", {
      detail: {
        key: this.cacheKey,
        size,
        width: `${size}px`,
        minSize: this.minSize,
        maxSize: this.maxSize,
      }
    })
  }

  setWidth(width) {
    if (!Number.isFinite(width)) return
    this.size = width
  }

  toggleWidth() {
    this.setWidth(this.size >= this.maxSize ? this.minSize : this.maxSize)
  }

  get cacheKey(){
    return `resize-bar[${this.keyValue || getPathTo(this.targetTarget)}]width`
  }

  get cachedSize(){
    if(!this.rememberValue) return null
    return localStorage.getItem(this.cacheKey)
  }

  set cachedSize(v){
    if(!this.rememberValue) return
    localStorage.setItem(this.cacheKey, v)
  }

  startDrag(event){
    event.preventDefault()
    this.startPos = event.clientX;
    this.currentStartSize = this.size;
    this.barTarget.classList.add(...this.draggingClasses)
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', this.drag)
    document.addEventListener('mouseup', this.dragEnd, { once: true })
    document.body.classList.add('resize-bar-dragging')
  }

  dragEnd(event){
    event.preventDefault()
    document.removeEventListener('mousemove', this.drag)
    this.barTarget.classList.remove(...this.draggingClasses)
    document.body.classList.remove('resize-bar-dragging')
    document.body.style.userSelect = ''
  }

  drag(event){
    let moved = event.clientX - this.startPos;
    let newSize = this.currentStartSize + (this.directionValue === 'left' ? -moved : moved);
    if (newSize < this.minSize) {
      newSize = this.minSize;
    } else if (newSize > this.maxSize) {
      newSize = this.maxSize;
    }

    this.size = newSize
  }
}
