# 원수살림 배포

## Supabase 준비

1. Supabase 프로젝트를 만든다.
2. SQL Editor에서 `supabase-shared-login.sql` 내용을 실행한다.
3. Project Settings > API에서 Project URL과 anon public key를 확인한다.

## Vercel 환경변수

Vercel 프로젝트 Settings > Environment Variables에 아래 값을 추가한다.

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## GitHub + Vercel

1. 이 `budget-vercel` 폴더를 GitHub 저장소로 올린다.
2. Vercel에서 해당 저장소를 Import 한다.
3. Build Command는 `npm run build`를 사용한다.
4. Output Directory는 `dist`를 사용한다. `vercel.json`에 이미 설정되어 있다.

배포 후 설정 > 공유 로그인에서 같은 가계부 아이디와 비밀번호를 입력하면 여러 기기에서 같은 데이터를 사용할 수 있다.

기존에 공유 로그인을 사용 중인 프로젝트도 동시 수정 충돌 방지를 위해 최신 `supabase-shared-login.sql`을 SQL Editor에서 한 번 다시 실행해야 한다.

`supabase-schema.sql`은 Supabase 이메일 인증을 사용하는 이전 저장 방식의 스키마이며, 현재 공유 로그인 기능에서는 사용하지 않는다.
