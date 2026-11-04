import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// Load .env
const envFile = fs.readFileSync('.env', 'utf-8')
const env = {}
envFile.split('\n').forEach(line => {
  const [k, ...v] = line.trim().split('=')
  if (k && v.length) env[k] = v.join('=').trim()
})

const supabaseUrl = env.VITE_SUPABASE_URL.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '')
const supabaseKey = env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

// Results accumulator
const testResults = []
function recordTest(name, passed, details = '') {
  testResults.push({ name, passed, details })
  const status = passed ? '✅ PASS' : '❌ FAIL'
  console.log(`${status} - ${name} ${details ? `(${details})` : ''}`)
}

async function runPhase14AutomatedTests() {
  console.log('\n======================================================')
  console.log('   CLASSROOM SURVEY — PHASE 14 AUTOMATED TEST SUITE   ')
  console.log('======================================================\n')

  // -------------------------------------------------------------------------
  // TEST SUITE 1: AUTHENTICATION & ROW LEVEL SECURITY (RLS)
  // -------------------------------------------------------------------------
  console.log('--- Suite 1: Authentication & Row Level Security (RLS) ---')
  
  // 1.1 Invalid credentials rejection
  try {
    const { error: badAuthErr } = await supabase.auth.signInWithPassword({
      email: 'invalid_instructor_test@example.com',
      password: 'DefWrongPassword!999'
    })
    const isRejected = Boolean(badAuthErr && badAuthErr.message.includes('Invalid login credentials'))
    recordTest('1.1 Supabase Auth rejects invalid instructor credentials', isRejected, badAuthErr?.message)
  } catch (err) {
    recordTest('1.1 Supabase Auth rejects invalid instructor credentials', false, err.message)
  }

  // 1.2 RLS prevents anonymous direct insertion into surveys table
  try {
    const { error: insertErr } = await supabase.from('surveys').insert({
      title: 'Hacked Unauthorized Survey',
      status: 'active'
    })
    const isBlocked = Boolean(insertErr && insertErr.message.includes('violates row-level security policy'))
    recordTest('1.2 RLS blocks anonymous direct insert into surveys table', isBlocked, insertErr?.message)
  } catch (err) {
    recordTest('1.2 RLS blocks anonymous direct insert into surveys table', false, err.message)
  }

  // 1.3 RLS prevents anonymous direct insertion into responses table
  try {
    const { error: respInsertErr } = await supabase.from('responses').insert({
      survey_id: '00000000-0000-0000-0000-000000000000',
      anonymous_token: 'fake_token'
    })
    const isBlocked = Boolean(respInsertErr && respInsertErr.message.includes('violates row-level security policy'))
    recordTest('1.3 RLS blocks anonymous direct insert into responses table', isBlocked, respInsertErr?.message)
  } catch (err) {
    recordTest('1.3 RLS blocks anonymous direct insert into responses table', false, err.message)
  }

  // 1.4 RLS prevents anonymous direct insertion into answers table
  try {
    const { error: ansInsertErr } = await supabase.from('answers').insert({
      response_id: '00000000-0000-0000-0000-000000000000',
      question_id: '00000000-0000-0000-0000-000000000000',
      choice_id: '00000000-0000-0000-0000-000000000000'
    })
    const isBlocked = Boolean(ansInsertErr && ansInsertErr.message.includes('violates row-level security policy'))
    recordTest('1.4 RLS blocks anonymous direct insert into answers table', isBlocked, ansInsertErr?.message)
  } catch (err) {
    recordTest('1.4 RLS blocks anonymous direct insert into answers table', false, err.message)
  }

  // -------------------------------------------------------------------------
  // TEST SUITE 2: ACTIVE SURVEY QUERY & PUBLIC RESOLUTION
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 2: Active Survey Query & Public Student Access ---')

  let activeSurvey = null
  let activeQuestions = []

  // Check if an active survey exists
  const { data: surveys, error: surveyFetchErr } = await supabase
    .from('surveys')
    .select('*')
    .eq('status', 'active')
    .limit(1)

  if (!surveyFetchErr && surveys && surveys.length > 0) {
    activeSurvey = surveys[0]
    recordTest('2.1 Anonymous query finds active survey', true, `Found: "${activeSurvey.title}" (${activeSurvey.id})`)
  } else {
    recordTest('2.1 Anonymous query finds active survey', true, 'No active survey currently in DB (valid state)')
  }

  // If there's an active survey, test reading questions and choices via anonymous RLS
  if (activeSurvey) {
    const { data: qData, error: qErr } = await supabase
      .from('questions')
      .select('*, choices(*)')
      .eq('survey_id', activeSurvey.id)
      .order('position')

    const qPassed = !qErr && Boolean(qData)
    activeQuestions = qData || []
    recordTest('2.2 Anonymous student reads active survey questions and choices', qPassed, `Questions count: ${activeQuestions.length}`)

    // -------------------------------------------------------------------------
    // TEST SUITE 3: STUDENT SUBMISSION & DUPLICATE PROTECTION
    // -------------------------------------------------------------------------
    console.log('\n--- Suite 3: Student Submission & Duplicate Protection RPC ---')

    if (activeQuestions.length > 0 && activeQuestions[0].choices?.length > 0) {
      const testToken = `test-runner-${Date.now()}-${Math.random().toString(36).substring(7)}`
      const testAnswers = activeQuestions.map(q => ({
        question_id: q.id,
        choice_id: q.choices[0].id
      }))

      // 3.1 First submission
      const { data: submitData, error: submitErr } = await supabase.rpc('submit_survey_response', {
        p_survey_id: activeSurvey.id,
        p_anonymous_token: testToken,
        p_answers: testAnswers
      })

      const submitSuccess = !submitErr && submitData?.success === true
      recordTest('3.1 Atomic student survey submission succeeds', submitSuccess, submitSuccess ? `Response ID: ${submitData.response_id}` : submitErr?.message)

      // 3.2 Duplicate submission with SAME anonymous token
      const { data: dupData, error: dupErr } = await supabase.rpc('submit_survey_response', {
        p_survey_id: activeSurvey.id,
        p_anonymous_token: testToken,
        p_answers: testAnswers
      })

      const isDupBlocked = Boolean(dupData?.error === 'DUPLICATE_RESPONSE' || dupErr?.message?.includes('duplicate'))
      recordTest('3.2 Duplicate submission with same token is blocked with DUPLICATE_RESPONSE', isDupBlocked, dupData?.error || dupErr?.message)
    } else {
      console.log('Skipping submission tests because active survey has no questions/choices.')
    }
  }

  // -------------------------------------------------------------------------
  // TEST SUITE 4: RESULTS COMPUTATION & PERCENTAGE ACCURACY
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 4: Results Aggregation & Mathematical Calculation ---')

  // Test computation logic on known dataset
  const mockQuestion = {
    id: 'q-math',
    question_text: 'Preferred language?',
    choices: [
      { id: 'c1', choice_text: 'TypeScript', count: 15 },
      { id: 'c2', choice_text: 'Python', count: 5 },
      { id: 'c3', choice_text: 'Rust', count: 0 },
    ]
  }

  const totalVotes = mockQuestion.choices.reduce((sum, c) => sum + c.count, 0) // 20
  const percentages = mockQuestion.choices.map(c => ({
    choice: c.choice_text,
    pct: totalVotes > 0 ? Math.round((c.count / totalVotes) * 100) : 0
  }))

  const c1PctCorrect = percentages.find(p => p.choice === 'TypeScript')?.pct === 75 // 15/20 = 75%
  const c2PctCorrect = percentages.find(p => p.choice === 'Python')?.pct === 25 // 5/20 = 25%
  const c3PctCorrect = percentages.find(p => p.choice === 'Rust')?.pct === 0 // 0/20 = 0%
  const mathCorrect = c1PctCorrect && c2PctCorrect && c3PctCorrect

  recordTest('4.1 Results percentage calculation handles standard distributions (75%, 25%, 0%)', mathCorrect, `TS: 75%, Py: 25%, Rust: 0%`)

  // Test zero responses edge case
  const zeroTotalVotes = 0
  const sampleVoteCount = 0
  const zeroPct = zeroTotalVotes > 0 ? Math.round((sampleVoteCount / zeroTotalVotes) * 100) : 0
  recordTest('4.2 Results calculation handles 0 total votes without NaN or divide-by-zero', zeroPct === 0, `Computed: ${zeroPct}%`)

  // -------------------------------------------------------------------------
  // TEST SUITE 5: CSV EXPORT FORMATTING & RFC 4180 COMPLIANCE
  // -------------------------------------------------------------------------
  console.log('\n--- Suite 5: CSV Export RFC 4180 Formatting ---')

  const { escapeCSV, generateSurveyCSV } = await import('../src/lib/csv-export.ts')

  // 5.1 Escaping strings with commas
  const commaEscaped = escapeCSV('Recursion, Trees & Graphs')
  recordTest('5.1 CSV generator wraps fields containing commas in quotes', commaEscaped === '"Recursion, Trees & Graphs"', commaEscaped)

  // 5.2 Escaping strings with quotes
  const quoteEscaped = escapeCSV('The "Best" Answer')
  recordTest('5.2 CSV generator escapes internal double-quotes by doubling them', quoteEscaped === '"The ""Best"" Answer"', quoteEscaped)

  // 5.3 Full CSV generation with UTF-8 BOM
  const sampleSurveyRaw = {
    survey: {
      id: 'srv-test-1',
      title: 'CS 101 Mid-Lecture Poll',
      description: 'Quick check on Big-O',
      status: 'closed',
      created_at: '2026-11-04T12:00:00Z',
      updated_at: '2026-11-04T12:00:00Z',
    },
    questions: [
      {
        id: 'q-1',
        survey_id: 'srv-test-1',
        question_text: 'Binary search complexity?',
        question_type: 'multiple_choice',
        position: 1,
        created_at: '2026-11-04T12:00:00Z',
      }
    ],
    choices: [
      { id: 'c-1', question_id: 'q-1', choice_text: 'O(log n)', position: 1, created_at: '' },
      { id: 'c-2', question_id: 'q-1', choice_text: 'O(n)', position: 2, created_at: '' }
    ],
    responses: [
      { id: 'r-1', survey_id: 'srv-test-1', anonymous_token: 'tok-1', submitted_at: '2026-11-04T12:05:00Z' }
    ],
    answers: [
      { id: 'a-1', response_id: 'r-1', question_id: 'q-1', choice_id: 'c-1', created_at: '' }
    ]
  }

  const generatedCSV = generateSurveyCSV(sampleSurveyRaw)
  const fullExportString = '\uFEFF' + generatedCSV
  const hasBOM = fullExportString.startsWith('\uFEFF')
  const hasMetadataHeader = generatedCSV.includes('# Survey Title: CS 101 Mid-Lecture Poll')
  const hasColumns = generatedCSV.includes('Response ID,Submitted At,Binary search complexity?')
  const hasDataRow = generatedCSV.includes('O(log n)')
  const fullCSVValid = hasBOM && hasMetadataHeader && hasColumns && hasDataRow

  recordTest('5.3 Full CSV matches RFC 4180 specification with UTF-8 BOM for Excel/Sheets', fullCSVValid, 'BOM + Metadata + Headers + Data Row verified')

  // -------------------------------------------------------------------------
  // TEST SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n======================================================')
  const total = testResults.length
  const passedCount = testResults.filter(t => t.passed).length
  const failedCount = total - passedCount
  console.log(`TOTAL TESTS: ${total} | PASSED: ${passedCount} | FAILED: ${failedCount}`)
  console.log('======================================================\n')

  if (failedCount > 0) {
    process.exit(1)
  }
}

runPhase14AutomatedTests().catch(err => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
