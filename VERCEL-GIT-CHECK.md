# Vercel에서 연결된 Git 저장소 확인하는 방법

배포가 반영 안 될 때, Vercel이 **어느 GitHub 저장소**를 보고 배포하는지 확인하는 절차예요.

---

## 1. Vercel 로그인 및 프로젝트 선택

1. 브라우저에서 **https://vercel.com** 접속
2. 로그인 (GitHub로 로그인했으면 그 계정으로 들어감)
3. **Dashboard**에서 **my-lifestyle-app** (또는 사용 중인 프로젝트 이름) 클릭  
   → 프로젝트 대시보드로 들어감

---

## 2. Settings로 이동

4. 상단 탭에서 **Settings** 클릭  
   (Overview / Deployments / Analytics / **Settings** / … 중 하나)

---

## 3. Git 섹션 찾기

5. 왼쪽 사이드바에서 **Git** 클릭  
   (또는 Settings 페이지를 아래로 내리면 **Git** 섹션이 나옴)

---

## 4. Connected Git Repository 확인

6. **Connected Git Repository** 라는 제목 아래를 봄

   보이는 내용 예시:

   ```
   Connected Git Repository
   xorgka / my-lifestyle-app
   ```
   또는
   ```
   Repository
   https://github.com/xorgka/my-lifestyle-app
   ```

7. **여기 나오는 저장소가 맞는지 확인**

   - **맞는 경우**  
     - `xorgka` (또는 본인 GitHub 아이디)  
     - `my-lifestyle-app` (저장소 이름)  
     → 로컬에서 `git push origin main` 하는 그 저장소와 같아야 함.

   - **다른 경우**  
     - 예: `other-user/my-lifestyle-app` 이나 `xorgka/other-repo`  
     → Vercel은 **이 저장소**만 배포함.  
     → 지금 수정·푸시하는 폴더가 **이 저장소**와 연결돼 있지 않으면, 푸시해도 배포에 반영 안 됨.

---

## 5. 로컬 저장소와 비교하는 방법

로컬 터미널에서:

```powershell
cd "c:\Users\xorgk\Downloads\my-lifestyle-app"
git remote -v
```

나오는 주소 예시:

```
origin  https://github.com/xorgka/my-lifestyle-app.git (fetch)
origin  https://github.com/xorgka/my-lifestyle-app.git (push)
```

- **Vercel에 나온 저장소** = `xorgka/my-lifestyle-app`  
- **위 `origin` 주소** = `github.com/xorgka/my-lifestyle-app`  
→ **같은 저장소**면, 푸시한 코드가 Vercel이 보는 곳이 맞음.

다르면 (예: Vercel은 `someone-else/repo-name`)  
→ 그 저장소가 아닌 곳에 푸시하고 있는 거라, Vercel 배포는 안 바뀜.  
→ 해결: 이 프로젝트를 Vercel에 연결된 그 저장소로 push 하거나, Vercel에서 연결을 이 저장소(`xorgka/my-lifestyle-app`)로 바꿔야 함.

---

## 6. Production Branch도 같이 확인

같은 **Settings → Git** 화면에서:

- **Production Branch** 항목 확인
- 보통 `main` 또는 `master` 로 되어 있음

로컬에서 푸시하는 브랜치가 `main`이면, 여기도 **main**이어야  
`git push origin main` 할 때마다 프로덕션 배포가 갱신됨.

---

## 요약

| 확인 위치 | 확인할 것 |
|-----------|-----------|
| Vercel → 프로젝트 → **Settings** → **Git** | **Connected Git Repository** = `xorgka/my-lifestyle-app` (본인 repo와 동일한지) |
| 같은 화면 | **Production Branch** = `main` (푸시하는 브랜치와 같은지) |
| 로컬 `git remote -v` | `origin` 이 `github.com/xorgka/my-lifestyle-app` 인지 |

**Connected Git Repository**가 지금 푸시하는 GitHub 저장소와 **완전히 같아야**  
`git add .` → `git commit` → `git push` 한 내용이 온라인에 반영됩니다.
