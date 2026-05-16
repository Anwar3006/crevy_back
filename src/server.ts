// src/server.ts — this is what Node actually runs
import app from './index'
import { prepareDB } from '@config/db'
import { pinoLogger } from '@config/logger'
import settings from '@config/settings'

prepareDB().then(() => {
  app.listen(settings.APP_PORT, () =>
    pinoLogger.info(`Server running on port ${settings.APP_PORT}`)
  )
})