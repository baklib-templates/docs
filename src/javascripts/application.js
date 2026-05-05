import Alpine from 'alpinejs'
import collapse from '@alpinejs/collapse'
import './controllers'

window.Alpine = Alpine
Alpine.plugin(collapse)
Alpine.start()