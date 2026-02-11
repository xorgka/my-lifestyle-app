# Supabase 테이블 설계

## 실행 방법

1. [Supabase 대시보드](https://supabase.com/dashboard) → 프로젝트 선택
2. 왼쪽 **SQL Editor** → **New query**
3. `schema.sql` 전체 내용 복사 후 붙여넣기 → **Run**

### 기타 카테고리 추가 (이미 테이블을 만든 경우)

`budget_keywords` 테이블을 예전에 만들었다면, SQL Editor에서 아래를 실행해 주세요.

```sql
alter table budget_keywords drop constraint if exists budget_keywords_category_check;
alter table budget_keywords add constraint budget_keywords_category_check
  check (category in ('고정비', '사업경비', '세금', '생활비', '신용카드', '기타'));
insert into budget_keywords (category, keywords) values ('기타', '[]'::jsonb)
on conflict (category) do update set keywords = excluded.keywords, updated_at = now();
```

### 가계부 저장이 안 되고 새로고침하면 날아갈 때

RLS(행 수준 보안) 정책이 없으면 Supabase에서 insert/select가 막혀서 저장이 안 됩니다.  
**SQL Editor**에서 `rls-policies.sql` 내용을 실행해 주세요. (테이블은 이미 있다면 RLS 정책만 적용됩니다.)

### 노트·메모 기기/모바일/브라우저 연동

**노트**(에버노트 스타일)와 **메모**(포스트잇)를 모든 기기·브라우저에서 동기화하려면:

1. **Supabase SQL Editor → New query**에서 **`migration-sync-notes-memos.sql`** 전체 내용을 붙여넣고 **Run** 실행
2. 앱 환경 변수 설정:
   - `NEXT_PUBLIC_SUPABASE_URL` = Supabase 프로젝트 URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Supabase anon public key

설정 후에는 PC, 모바일, 다른 브라우저에서 같은 노트·메모가 보입니다. (한 번 로컬만 쓰다가 Supabase를 켜면, 첫 로드 시 해당 기기의 로컬 데이터가 Supabase로 한 번 올라갑니다.)

**스마트폰에서 연동이 안 될 때:** 스마트폰으로 여는 주소(배포 URL)가 **PC와 같은 빌드**여야 합니다. Vercel/Netlify 등에 배포했다면, 해당 프로젝트 설정에서 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 넣고 **다시 배포**해야 합니다. 환경 변수 없이 빌드된 주소로 열면 그 주소에서는 “이 기기만 저장됨”으로 나옵니다. 노트 페이지 상단에 “기기·브라우저 연동됨”이 보이면 연동된 것입니다.

---

### 유튜브 실제 입금 금액 테이블 (기기/브라우저 동기화)

유튜브 페이지의 **실제 입금 금액**(국민 6954/8189 등)을 기기·브라우저 간 연동하려면 **SQL Editor → New query**에서 아래 파일 내용을 붙여넣고 **Run** 하세요.

- **`migration-youtube-actual-deposits.sql`** — 테이블 `youtube_actual_deposits` 생성 + RLS + 트리거

(이미 `schema.sql`을 실행했다면 위 마이그레이션만 추가로 실행하면 됩니다.)

### 타임테이블 + 타임테이블↔루틴 연동 (기기/브라우저 동기화)

타임테이블(날짜별 시간대·항목·완료)과 **타임테이블 항목 ↔ 루틴 항목 연동**을 PC·모바일·모든 브라우저에서 맞추려면 **SQL Editor → New query**에서 아래를 **순서대로** 실행하세요.

1. **`migration-timetable.sql`** — 테이블 `timetable_days` (날짜별 슬롯·완료)
2. **`migration-timetable-routine-links.sql`** — 테이블 `timetable_routine_links` (타임테이블 항목 id → 루틴 항목 id)

환경 변수 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`가 설정된 상태에서 사용하면 새로고침해도 데이터가 유지되고, 다른 기기에서도 동일하게 보입니다.

### 유튜브 채널 테이블만 추가 (이미 schema.sql 실행한 경우)

유튜브 페이지를 Supabase로 쓰려면 **SQL Editor**에서 아래를 실행해 주세요.

```sql
create table if not exists youtube_channels (
  id bigint primary key,
  name text not null default '',
  channel_url text not null default '',
  category text not null default '',
  account_email text not null default '',
  password text not null default '',
  memo text not null default '',
  monthly_revenues jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table youtube_channels enable row level security;
create policy "allow all youtube_channels" on youtube_channels for all using (true) with check (true);
create trigger youtube_channels_updated_at
  before update on youtube_channels for each row execute function set_updated_at();
```

(`set_updated_at` 함수가 없다면 먼저 schema.sql의 해당 함수·트리거 부분을 참고해 만든 뒤 실행하세요.)

---

## 테이블 요약

| 테이블 | 용도 | 비고 |
|--------|------|------|
| **budget_entries** | 가계부 지출 내역 | 구글 시트 연동용 `source`, `external_id` 포함 |
| **budget_keywords** | 카테고리별 키워드 (고정비/사업경비 등) | 앱 설정 |
| **budget_month_extras** | 월별 추가 키워드 | JSONB |
| **journal_entries** | 일기 (날짜당 1건) | `date` unique |
| **youtube_channels** | 유튜브 채널·수익·계정·메모 | `monthly_revenues` JSONB: {"YYYY-MM": 원} |
| **routine_items** | 루틴 항목 목록 | `sort_order`로 순서 유지 |
| **routine_completions** | 날짜별 루틴 완료 기록 | (date, item_id) PK |
| **timetable_days** | 타임테이블 날짜별 슬롯·완료 | migration-timetable.sql |
| **timetable_routine_links** | 타임테이블 항목 ↔ 루틴 항목 연동 | migration-timetable-routine-links.sql |

---

## 가계부 ↔ 구글 시트 연동 시 참고

- **budget_entries**
  - `source`: `'app'` = 앱에서 입력, `'sheets'` = 시트에서 가져온 행
  - `external_id`: 시트 행을 식별할 값 (예: 시트 행 번호, 또는 고유 ID 열)
  - 시트 컬럼 예: `날짜`, `항목`, `금액`, `구분`(선택) → 각각 `date`, `item`, `amount`, `category`에 매핑
- 나중에 연동할 때: 시트 읽기 → `source='sheets'`, `external_id=행ID`로 insert/update 하면 앱 입력과 구분·중복 방지 가능

---

## (선택) budget_keywords 초기 데이터

앱의 기본 키워드를 DB에 넣으려면 SQL Editor에서 아래 실행:

```sql
insert into budget_keywords (category, keywords) values
  ('고정비', '["건강보험","국민연금","주택청약","적금","IRP","ISA","보험","자동차 보험","통신비","푸르내","관리비","도시가스"]'::jsonb),
  ('사업경비', '["GPT","클로드","젠스파크","커서AI","그록","제미나이","아임웹","캡컷","타입캐스트","세무사"]'::jsonb),
  ('생활비', '["식비","편의점","강아지","배달","쿠팡","배민","컬리","외식"]'::jsonb),
  ('신용카드', '["악사보험","클라우드웨이즈","KT통신요금"]'::jsonb),
  ('세금', '["부가세","종합소득세","자동차세","면허세"]'::jsonb),
  ('기타', '[]'::jsonb)
on conflict (category) do update set keywords = excluded.keywords, updated_at = now();
```
