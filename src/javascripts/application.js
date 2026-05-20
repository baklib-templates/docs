import Alpine from 'alpinejs'
import collapse from '@alpinejs/collapse'
import './controllers'

// Import utils
import { buildUrl, updateQuery, getQueryParams, getFilenameWithExtension } from './utils/index'
Alpine.magic('buildUrl', () => buildUrl)
Alpine.magic('updateQuery', () => updateQuery)
Alpine.magic('getQueryParams', () => getQueryParams)
Alpine.magic('getFilenameWithExtension', () => getFilenameWithExtension)

window.Alpine = Alpine
Alpine.plugin(collapse)
Alpine.start()
