import fs from 'fs'
import readline from 'readline'

const logsDir = 'C:/Users/Jacob/.gemini/antigravity/brain/7355e09f-b833-4a56-966f-c1199b30c749/.system_generated/logs'
const transcriptPath = `${logsDir}/transcript.jsonl`
const fullTranscriptPath = `${logsDir}/transcript_full.jsonl`
const outputPath = 'CONVERSATION_LOG.md'

async function getFullContentByStep(stepIndex) {
  if (!fs.existsSync(fullTranscriptPath)) return null
  const stream = fs.createReadStream(fullTranscriptPath)
  const rl = readline.createInterface({ input: stream })
  for await (const line of rl) {
    try {
      const obj = JSON.parse(line)
      if (obj.step_index === stepIndex) {
        return obj.content || ''
      }
    } catch {}
  }
  return null
}

async function buildLog() {
  if (!fs.existsSync(transcriptPath)) {
    console.error('Transcript file not found:', transcriptPath)
    return
  }

  const stream = fs.createReadStream(transcriptPath)
  const rl = readline.createInterface({ input: stream })

  const entries = []
  let currentPair = null

  for await (const line of rl) {
    try {
      const obj = JSON.parse(line)

      if (obj.type === 'USER_INPUT') {
        let content = obj.content || ''
        // Clean out system metadata or tags if present
        if (obj.truncated_fields && obj.truncated_fields.includes('content')) {
          const full = await getFullContentByStep(obj.step_index)
          if (full) content = full
        }

        // Clean user input from xml tags if any
        const cleaned = content
          .replace(/<CONTEXT_SUMMARY>[\s\S]*?<\/CONTEXT_SUMMARY>/g, '')
          .replace(/<USER_REQUEST>/g, '')
          .replace(/<\/USER_REQUEST>/g, '')
          .replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/g, '')
          .trim()

        if (cleaned) {
          if (currentPair && (currentPair.user || currentPair.assistant)) {
            entries.push(currentPair)
          }
          currentPair = {
            step: obj.step_index,
            time: obj.created_at,
            user: cleaned,
            assistant: ''
          }
        }
      } else if (obj.type === 'PLANNER_RESPONSE' && currentPair) {
        let content = obj.content || ''
        if (obj.truncated_fields && obj.truncated_fields.includes('content')) {
          const full = await getFullContentByStep(obj.step_index)
          if (full) content = full
        }
        if (content && content.trim()) {
          // If there were multiple planner response steps with text, concatenate or take final
          currentPair.assistant = currentPair.assistant
            ? `${currentPair.assistant}\n\n${content.trim()}`
            : content.trim()
        }
      }
    } catch (e) {
      console.error('Parse error:', e)
    }
  }

  if (currentPair && (currentPair.user || currentPair.assistant)) {
    entries.push(currentPair)
  }

  // Format into Markdown
  const markdownLines = []
  markdownLines.push('# Classroom Survey — Conversation History Log\n')
  markdownLines.push(`*Generated on: ${new Date().toISOString()}*\n`)
  markdownLines.push('> [!NOTE]\n> This log is automatically maintained and contains all prompts from the user and responses from the assistant throughout this pair-programming session.\n\n---\n')

  entries.forEach((entry, idx) => {
    const num = idx + 1
    markdownLines.push(`## Exchange #${num}\n`)
    if (entry.time) {
      markdownLines.push(`**Timestamp:** \`${entry.time}\`\n`)
    }
    markdownLines.push('### 👤 User Prompt\n')
    markdownLines.push(entry.user || '*(No text content)*')
    markdownLines.push('\n\n### 🤖 Antigravity Assistant Response\n')
    markdownLines.push(entry.assistant || '*(Processing / Tool actions executed)*')
    markdownLines.push('\n\n---\n')
  })

  // Add the current latest prompt from user:
  // "can you make a log of all prompts and answers from this chat and continue to for the rest of the convo"
  const lastEntry = entries[entries.length - 1]
  if (!lastEntry || !lastEntry.user.includes('make a log of all prompts')) {
    markdownLines.push(`## Exchange #${entries.length + 1}\n`)
    markdownLines.push(`**Timestamp:** \`${new Date().toISOString()}\`\n`)
    markdownLines.push('### 👤 User Prompt\n')
    markdownLines.push('can you make a log of all prompts and answers from this chat and continue to for the rest of the convo\n')
    markdownLines.push('### 🤖 Antigravity Assistant Response\n')
    markdownLines.push('*(Log initialized in `CONVERSATION_LOG.md`. All future prompts and responses will be continuously appended here.)*\n\n---\n')
  }

  fs.writeFileSync(outputPath, markdownLines.join('\n'), 'utf-8')
  console.log(`Successfully generated ${outputPath} with ${entries.length} exchanges.`)
}

buildLog().catch(console.error)

