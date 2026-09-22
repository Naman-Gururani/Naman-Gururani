// scripts/github.mjs — the only part of the card pipeline that touches the network.
//
// One POST to the GraphQL API, one shape check, and a flattening step that
// turns GitHub's edge/node nesting into plain records. Everything downstream is
// pure, so the maths can be tested without an API shape in the test.
const API = 'https://api.github.com/graphql'

export async function gql(query, variables, token) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'naman-profile-cards' },
    body: JSON.stringify({ query, variables }),
  })
  if (!r.ok) throw new Error(`GitHub API ${r.status} ${r.statusText}`)
  const body = await r.json()
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join('; '))
  return body.data
}

export const PROFILE_QUERY = `query($login:String!){
  user(login:$login){
    contributionsCollection{
      totalCommitContributions
      restrictedContributionsCount
      totalPullRequestContributions
      totalIssueContributions
      contributionCalendar{ totalContributions weeks{ contributionDays{ date contributionCount } } }
    }
    repositories(first:100, ownerAffiliations:OWNER, orderBy:{field:PUSHED_AT, direction:DESC}){
      totalCount
      nodes{ name isFork stargazerCount languages(first:10, orderBy:{field:SIZE, direction:DESC}){ edges{ size node{ name } } } }
    }
    followers{ totalCount }
  }
}`

/**
 * Everything the cards need, in the shape the pure functions expect. Throwing
 * here — rather than rendering a card full of `undefined` — is the whole point:
 * a bad day exits non-zero and writes nothing.
 */
export function profile(data) {
  const user = data?.user
  if (!user) throw new Error('the API returned no user — check GITHUB_LOGIN')

  const c = user.contributionsCollection
  const weeks = c?.contributionCalendar?.weeks
  if (!Array.isArray(weeks)) throw new Error('the response carried no contribution calendar')

  const nodes = user.repositories?.nodes
  if (!Array.isArray(nodes)) throw new Error('the response carried no repositories')

  const days = weeks
    .flatMap((w) => w?.contributionDays ?? [])
    .filter((d) => typeof d?.date === 'string')
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  if (!days.length) throw new Error('the contribution calendar came back empty')

  // GraphQL hands languages over as edges; the maths wants { name, size }.
  const repos = nodes.filter(Boolean).map((n) => ({
    name: n.name,
    isFork: Boolean(n.isFork),
    stars: n.stargazerCount ?? 0,
    languages: (n.languages?.edges ?? [])
      .filter((e) => e?.node?.name)
      .map((e) => ({ name: e.node.name, size: e.size ?? 0 })),
  }))

  return {
    days,
    weeks: weeks.map((w) => (w?.contributionDays ?? []).filter((d) => typeof d?.date === 'string')),
    repos,
    repoCount: user.repositories.totalCount ?? repos.length,
    repoCountIsExact: (user.repositories.totalCount ?? repos.length) <= repos.length,
    followers: user.followers?.totalCount ?? 0,
    stars: repos.filter((r) => !r.isFork).reduce((a, r) => a + r.stars, 0),
    commits: c.totalCommitContributions ?? 0,
    pullRequests: c.totalPullRequestContributions ?? 0,
    issues: c.totalIssueContributions ?? 0,
    restricted: c.restrictedContributionsCount ?? 0,
    contributions: c.contributionCalendar.totalContributions ?? 0,
  }
}
