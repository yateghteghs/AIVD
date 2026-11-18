\set ON_ERROR_STOP on
insert into auth.users values ('11111111-1111-1111-1111-111111111111','rev@example.org'),('22222222-2222-2222-2222-222222222222','stranger@example.org');
insert into public.reviewers (user_id,email) select id,email from auth.users where email='rev@example.org';

-- 1. anon: may insert, may not read
set role anon;
insert into public.questions (id,question,lang,type,basis,citations,corpus) values (gen_random_uuid(),'Can I vote if I am 17?','en','answer','act','["Electoral Act 2026, s. 12(1)"]','official');
insert into public.questions (id,question,lang,type) values (gen_random_uuid(),'Wetin be BVAS?','pcm','not_covered');
insert into public.feedback (question_id,rating,question,lang,type) values (gen_random_uuid(),1,'Can I vote if I am 17?','en','answer');
insert into public.feedback (rating,lang,type) values (-1,'pcm','not_covered');
insert into public.flags (id,question,lang,type,category) values ('flag_t1','Is vote buying an offence?','en','answer','Answer is wrong or unclear');
\echo anon inserts OK
do $$ begin perform 1 from public.questions; raise exception 'FAIL anon can read questions'; exception when insufficient_privilege then raise notice 'OK anon cannot read questions'; end $$;
do $$ begin insert into public.feedback (rating) values (5); raise exception 'FAIL bad rating accepted'; exception when check_violation or insufficient_privilege then raise notice 'OK bad rating rejected'; end $$;
do $$ begin insert into public.questions (id,question,lang,type) values (gen_random_uuid(),'x','fr','answer'); raise exception 'FAIL bad lang accepted'; exception when check_violation or insufficient_privilege then raise notice 'OK bad lang rejected'; end $$;
do $$ begin update public.flags set status='resolved'; raise exception 'FAIL anon can update flags'; exception when insufficient_privilege then raise notice 'OK anon cannot update flags'; end $$;
reset role;

-- 2. signed-in non-reviewer: sees nothing, changes nothing
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
select 'stranger sees questions: ' || count(*) from public.questions;
select 'stranger sees flags: ' || count(*) from public.flags;
select 'stranger is_reviewer: ' || public.is_reviewer();
update public.flags set status='resolved';
select 'flags resolved by stranger: ' || count(*) from public.flags where status='resolved';
reset role;

-- 3. reviewer: reads everything, triages flags, cannot alter voter text
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select 'reviewer sees questions: ' || count(*) from public.questions;
select 'reviewer sees feedback: ' || count(*) from public.feedback;
select 'reviewer sees flags: ' || count(*) from public.flags;
select 'reviewer is_reviewer: ' || public.is_reviewer();
update public.flags set status='resolved', reviewer='rev@example.org', resolution='Fixed in keywords.json', reviewed_at=now() where id='flag_t1';
select 'flag status now: ' || status || ' / ' || resolution from public.flags where id='flag_t1';
do $$ begin update public.flags set question='tampered'; raise exception 'FAIL reviewer edited voter text'; exception when insufficient_privilege then raise notice 'OK reviewer cannot edit voter question text'; end $$;
do $$ begin update public.flags set status='deleted'; raise exception 'FAIL bad status accepted'; exception when check_violation or insufficient_privilege then raise notice 'OK invalid status rejected'; end $$;
do $$ begin delete from public.flags; if found then raise exception 'FAIL reviewer deleted'; end if; raise notice 'OK reviewer delete removed nothing'; exception when insufficient_privilege then raise notice 'OK reviewer cannot delete'; end $$;
reset role;

-- 4. roles (003_team.sql)
update public.reviewers set role = 'super_admin' where email = 'rev@example.org';
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select 'super admin is_super_admin: ' || public.is_super_admin();
do $$ begin perform public.user_id_by_email('rev@example.org'); raise exception 'FAIL browser can look up emails'; exception when insufficient_privilege then raise notice 'OK signed-in users cannot look up accounts by email'; end $$;
do $$ begin update public.reviewers set role = 'super_admin'; raise exception 'FAIL reviewer changed roles'; exception when insufficient_privilege then raise notice 'OK reviewers cannot change roles from the browser'; end $$;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
select 'stranger is_super_admin: ' || public.is_super_admin();
reset role;
set role anon;
do $$ begin perform public.user_id_by_email('rev@example.org'); raise exception 'FAIL anon can look up emails'; exception when insufficient_privilege then raise notice 'OK anon cannot look up accounts by email'; end $$;
reset role;
set role service_role;
select 'server lookup finds: ' || coalesce(public.user_id_by_email('REV@example.org')::text, 'nothing');
reset role;
do $$ begin update public.reviewers set role = 'boss'; raise exception 'FAIL bad role accepted'; exception when check_violation then raise notice 'OK invalid role rejected'; end $$;

-- 5. languages (004_languages.sql)
set role anon;
insert into public.questions (id,question,lang,type) values (gen_random_uuid(),'Ta ni kí n dìbò fún?','yo','refused');
insert into public.feedback (rating,lang,type) values (1,'ha','answer');
insert into public.flags (id,question,lang,type) values ('flag_t2','Onye ka m ga-atụrụ vootu?','ig','refused');
insert into public.questions (id,question,lang,type) values (gen_random_uuid(),'Tiv question','tiv','answer');
\echo   OK Yoruba, Hausa, Igbo and Tiv rows accepted
do $$ begin insert into public.questions (id,question,lang,type) values (gen_random_uuid(),'x','fr','answer'); raise exception 'FAIL unlisted language accepted'; exception when insufficient_privilege or check_violation then raise notice 'OK unlisted language still rejected'; end $$;
reset role;
\echo ALL RLS CHECKS DONE
