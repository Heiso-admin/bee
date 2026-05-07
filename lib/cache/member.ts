import { unstable_cache } from 'next/cache'
import { db } from '@heiso-io/bee/lib/db'
import type { TMember } from '@heiso-io/bee/lib/db/schema/auth/members'

/**
 * Cached version of getMemberByEmail().
 * Tag: `member:{email}`
 */
export async function cachedGetMemberByEmail(
    email: string,
): Promise<TMember | null> {
    const cached = unstable_cache(
        async () => {
            const member = await db.query.members.findFirst({
                where: (t, { eq: e }) => e(t.email, email),
            })
            return member || null
        },
        [`member:${email}`],
        { tags: [`member:${email}`] },
    )
    return cached()
}
