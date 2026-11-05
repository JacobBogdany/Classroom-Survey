-- =============================================================================
-- Migration: 20261104000000_initial_schema.sql
-- Description: Complete initial schema for Classroom Survey Web Application
-- Tables: surveys, questions, choices, responses, answers
-- Constraints, Indexes, RLS Policies, and Stored Procedures (RPCs)
-- =============================================================================

-- 1. Create Tables
-- -----------------------------------------------------------------------------

-- surveys: Stores survey metadata and activation status
create table if not exists surveys (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text,
    status text not null default 'draft'
        check (status in ('draft', 'active', 'closed', 'archived')),
    public_slug text unique,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- questions: Questions linked to a survey
create table if not exists questions (
    id uuid primary key default gen_random_uuid(),
    survey_id uuid not null references surveys(id) on delete cascade,
    question_text text not null,
    question_type text not null
        check (question_type in ('multiple_choice', 'true_false')),
    position integer not null,
    created_at timestamptz not null default now()
);

-- choices: Options for multiple choice or true/false questions
create table if not exists choices (
    id uuid primary key default gen_random_uuid(),
    question_id uuid not null references questions(id) on delete cascade,
    choice_text text not null,
    position integer not null,
    created_at timestamptz not null default now()
);

-- responses: Anonymous student submissions
create table if not exists responses (
    id uuid primary key default gen_random_uuid(),
    survey_id uuid not null references surveys(id) on delete cascade,
    anonymous_token text,
    submitted_at timestamptz not null default now()
);

-- answers: Individual question answers for a submission
create table if not exists answers (
    id uuid primary key default gen_random_uuid(),
    response_id uuid not null references responses(id) on delete cascade,
    question_id uuid not null references questions(id) on delete cascade,
    choice_id uuid references choices(id) on delete set null,
    text_answer text,
    created_at timestamptz not null default now(),
    unique(response_id, question_id)
);

-- 2. Indexes & Unique Constraints
-- -----------------------------------------------------------------------------
create index if not exists surveys_status_idx on surveys(status);
create index if not exists questions_survey_id_idx on questions(survey_id);
create index if not exists choices_question_id_idx on choices(question_id);
create index if not exists responses_survey_id_idx on responses(survey_id);
create index if not exists responses_submitted_at_idx on responses(submitted_at);
create index if not exists answers_response_id_idx on answers(response_id);
create index if not exists answers_question_id_idx on answers(question_id);
create index if not exists answers_choice_id_idx on answers(choice_id);

-- Enforce duplicate-prevention constraint per survey per student token
create unique index if not exists responses_unique_student_per_survey
on responses(survey_id, anonymous_token)
where anonymous_token is not null;

-- Enforce exactly one active survey across the application
create unique index if not exists only_one_active_survey
on surveys ((status))
where status = 'active';

-- 3. Automatic Updated Timestamp Trigger
-- -----------------------------------------------------------------------------
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists surveys_updated_at on surveys;
create trigger surveys_updated_at
before update on surveys
for each row
execute function update_updated_at_column();

-- 4. Row Level Security (RLS)
-- -----------------------------------------------------------------------------
alter table surveys enable row level security;
alter table questions enable row level security;
alter table choices enable row level security;
alter table responses enable row level security;
alter table answers enable row level security;

-- Public Student Policies (anon) — Read active surveys only
drop policy if exists "students read active surveys" on surveys;
create policy "students read active surveys"
on surveys
for select
to anon
using (status = 'active');

drop policy if exists "students read active survey questions" on questions;
create policy "students read active survey questions"
on questions
for select
to anon
using (
    exists (
        select 1
        from surveys
        where surveys.id = questions.survey_id
        and surveys.status = 'active'
    )
);

drop policy if exists "students read active survey choices" on choices;
create policy "students read active survey choices"
on choices
for select
to anon
using (
    exists (
        select 1
        from questions
        join surveys on surveys.id = questions.survey_id
        where questions.id = choices.question_id
        and surveys.status = 'active'
    )
);

-- Instructor Policies (authenticated) — Full CRUD access
drop policy if exists "authenticated users manage surveys" on surveys;
create policy "authenticated users manage surveys"
on surveys
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated users manage questions" on questions;
create policy "authenticated users manage questions"
on questions
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated users manage choices" on choices;
create policy "authenticated users manage choices"
on choices
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated users manage responses" on responses;
create policy "authenticated users manage responses"
on responses
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated users manage answers" on answers;
create policy "authenticated users manage answers"
on answers
for all
to authenticated
using (true)
with check (true);

-- 5. Stored Procedures / RPC Functions
-- -----------------------------------------------------------------------------

-- activate_survey: Closes any active survey, assigns slug, activates survey
create or replace function activate_survey(p_survey_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_slug text;
    v_survey surveys;
begin
    -- 1. Close any existing active survey
    update surveys
    set status = 'closed', updated_at = now()
    where status = 'active';

    -- 2. Create public slug if needed
    select public_slug into v_slug from surveys where id = p_survey_id;
    if v_slug is null or v_slug = '' then
        v_slug := lower(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    end if;

    -- 3. Activate target survey
    update surveys
    set status = 'active', public_slug = v_slug, updated_at = now()
    where id = p_survey_id
    returning * into v_survey;

    if not found then
        raise exception 'SURVEY_NOT_FOUND';
    end if;

    return jsonb_build_object(
        'id', v_survey.id,
        'status', v_survey.status,
        'public_slug', v_survey.public_slug
    );
end;
$$;

-- close_survey: Safely sets status to closed
create or replace function close_survey(p_survey_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_survey surveys;
begin
    update surveys
    set status = 'closed', updated_at = now()
    where id = p_survey_id
    returning * into v_survey;

    if not found then
        raise exception 'SURVEY_NOT_FOUND';
    end if;

    return jsonb_build_object(
        'id', v_survey.id,
        'status', v_survey.status
    );
end;
$$;

-- submit_survey_response: Atomic transaction for anonymous student responses
create or replace function submit_survey_response(
    p_survey_id uuid,
    p_anonymous_token text,
    p_answers jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_status text;
    v_response_id uuid;
    v_item jsonb;
    v_question_id uuid;
    v_choice_id uuid;
    v_text text;
begin
    -- 1. Verify survey is active
    select status into v_status from surveys where id = p_survey_id;
    if v_status is null or v_status <> 'active' then
        raise exception 'SURVEY_NOT_ACTIVE';
    end if;

    -- 2. Prevent duplicate submission with same anonymous token
    if p_anonymous_token is not null and p_anonymous_token <> '' then
        if exists (
            select 1 from responses
            where survey_id = p_survey_id and anonymous_token = p_anonymous_token
        ) then
            raise exception 'DUPLICATE_RESPONSE';
        end if;
    end if;

    -- 3. Create response
    insert into responses (survey_id, anonymous_token, submitted_at)
    values (p_survey_id, p_anonymous_token, now())
    returning id into v_response_id;

    -- 4. Insert each answer
    if p_answers is not null and jsonb_typeof(p_answers) = 'array' then
        for v_item in select * from jsonb_array_elements(p_answers)
        loop
            v_question_id := (v_item->>'question_id')::uuid;
            v_choice_id   := nullif(v_item->>'choice_id', '')::uuid;
            v_text        := v_item->>'text_answer';

            -- Verify question belongs to this survey
            if not exists (select 1 from questions where id = v_question_id and survey_id = p_survey_id) then
                raise exception 'INVALID_QUESTION';
            end if;

            -- Verify choice belongs to this question (if choice_id provided)
            if v_choice_id is not null and not exists (
                select 1 from choices where id = v_choice_id and question_id = v_question_id
            ) then
                raise exception 'INVALID_CHOICE';
            end if;

            insert into answers (response_id, question_id, choice_id, text_answer)
            values (v_response_id, v_question_id, v_choice_id, v_text);
        end loop;
    end if;

    return jsonb_build_object(
        'success', true,
        'response_id', v_response_id
    );
end;
$$;

