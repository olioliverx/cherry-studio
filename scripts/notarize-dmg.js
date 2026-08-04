require('dotenv').config()
const { execFileSync } = require('node:child_process')
const { notarize } = require('@electron/notarize')

// electron-builder notarizes the .app in afterSign, but the .dmg it wraps around that app
// afterwards is left unsigned. A downloaded .dmg carries the quarantine flag, so Gatekeeper
// assesses the disk image itself and rejects it as unsigned. Sign and notarize it here.
exports.default = async function notarizeDmg(buildResult) {
  if (process.platform !== 'darwin') {
    return []
  }

  if (!process.env.APPLE_ID || !process.env.APPLE_APP_SPECIFIC_PASSWORD || !process.env.APPLE_TEAM_ID) {
    return []
  }

  const dmgPaths = buildResult.artifactPaths.filter((artifactPath) => artifactPath.endsWith('.dmg'))

  for (const dmgPath of dmgPaths) {
    console.log('  • Signing dmg:', dmgPath)
    execFileSync('codesign', [
      '--sign',
      process.env.CSC_NAME || 'Developer ID Application',
      '--timestamp',
      '--force',
      dmgPath
    ])

    await notarize({
      appPath: dmgPath,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID
    })

    console.log('  • Notarized dmg:', dmgPath)
  }

  return []
}
