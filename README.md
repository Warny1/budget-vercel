# 가계부 배포

## Supabase 준비

1. Supabase 프로젝트를 만든다.
2. SQL Editor에서 `supabase-schema.sql` 내용을 실행한다.
3. Project Settings > API에서 Project URL과 anon public key를 확인한다.

## Vercel 환경변수

Vercel 프로젝트 Settings > Environment Variables에 아래 값을 추가한다.

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## GitHub + Vercel

1. 이 `budget-vercel` 폴더를 GitHub 저장소로 올린다.
2. Vercel에서 해당 저장소를 Import 한다.
3. Build Command는 `npm run build`를 사용한다.
4. Output Directory는 비워둔다.

배포 후 설정 > 클라우드에서 이메일 로그인 링크를 받아 로그인하면 데이터가 Supabase에 저장된다.
