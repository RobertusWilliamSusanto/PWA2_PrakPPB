import { apiClient, IS_SUPABASE } from '../config/api'
import { cache } from '../utils/cache'
import { getUserIdentifier } from './userService'

// ---------------------------------------------------------------------------
// ReviewService — full CRUD + Thumbs Up/Down voting with UNIQUE(user_id, review_id)
// ---------------------------------------------------------------------------

class ReviewService {
  /**
   * Fetch all reviews for a given product along with vote aggregates.
   */
  async getReviews(gunId) {
    if (!gunId) return { success: true, data: [] }
    const currentUserId = getUserIdentifier()
    const cacheKey = cache.generateKey('reviews:list', { gunId, currentUserId })

    const cached = cache.get(cacheKey)
    if (cached) return cached

    if (IS_SUPABASE) {
      try {
        const data = await apiClient.get(
          `/rest/v1/reviews?product_id=eq.${gunId}&select=*&order=created_at.desc`,
        )

        let reviews = Array.isArray(data) ? data : []

        // If there are reviews, eagerly fetch votes to avoid N+1 queries
        if (reviews.length > 0) {
          const reviewIds = reviews.map((r) => r.id).filter(Boolean)
          let votesMap = {}

          try {
            if (reviewIds.length > 0) {
              const votesData = await apiClient.get(
                `/rest/v1/review_votes?review_id=in.(${reviewIds.join(',')})&select=*`,
              )
              if (Array.isArray(votesData)) {
                votesData.forEach((v) => {
                  if (!votesMap[v.review_id]) {
                    votesMap[v.review_id] = { upvotes: 0, downvotes: 0, userVote: 0 }
                  }
                  if (v.value === 1) votesMap[v.review_id].upvotes++
                  if (v.value === -1) votesMap[v.review_id].downvotes++
                  if (v.user_id === currentUserId) {
                    votesMap[v.review_id].userVote = v.value
                  }
                })
              }
            }
          } catch (voteErr) {
            console.warn('[reviewService] review_votes table not reachable:', voteErr)
          }

          reviews = reviews.map((r) => {
            const stats = votesMap[r.id] || { upvotes: 0, downvotes: 0, userVote: 0 }
            return {
              id: r.id,
              product_id: r.product_id,
              user_id: r.user_id,
              user_identifier:
                r.user_id === currentUserId
                  ? 'You'
                  : r.user_id
                  ? `Operator ${String(r.user_id).substring(0, 8)}`
                  : 'Anonymous',
              is_owner: r.user_id === currentUserId,
              rating: Number(r.rating) || 5,
              comment: r.comment || '',
              created_at: r.created_at,
              upvotes: stats.upvotes,
              downvotes: stats.downvotes,
              userVote: stats.userVote,
            }
          })
        }

        const res = { success: true, data: reviews }
        cache.set(cacheKey, res, 60)
        return res
      } catch (err) {
        console.warn('Supabase getReviews error:', err)
      }
    }

    // University API fallback
    try {
      const res = await apiClient.get(`/api/v1/recipes/${gunId}/reviews`)
      cache.set(cacheKey, res, 60)
      return res
    } catch (err) {
      return { success: false, data: [], error: err.message }
    }
  }

  /**
   * Submit a new review (Validates rating 1-5 and comment).
   */
  async createReview(gunId, reviewData) {
    const rating = Number(reviewData.rating)
    if (isNaN(rating) || rating < 1 || rating > 5) {
      throw new Error('Rating harus antara 1 dan 5 bintang.')
    }

    const currentUserId = getUserIdentifier()
    cache.invalidate('reviews:')

    if (IS_SUPABASE) {
      const payload = {
        product_id: Number(gunId),
        user_id: reviewData.user_id || currentUserId,
        rating: rating,
        comment: (reviewData.comment || '').trim(),
      }

      const res = await apiClient.post('/rest/v1/reviews', payload, {
        headers: { Prefer: 'return=representation' },
      })
      const created = Array.isArray(res) ? res[0] : res
      return { success: true, data: created }
    }

    return apiClient.post(`/api/v1/recipes/${gunId}/reviews`, reviewData)
  }

  /**
   * Edit an existing review (Authorization check: owner only).
   */
  async updateReview(reviewId, reviewData) {
    const rating = Number(reviewData.rating)
    if (isNaN(rating) || rating < 1 || rating > 5) {
      throw new Error('Rating harus antara 1 dan 5 bintang.')
    }

    const currentUserId = getUserIdentifier()
    cache.invalidate('reviews:')

    if (IS_SUPABASE) {
      // Check ownership
      const existing = await apiClient.get(`/rest/v1/reviews?id=eq.${reviewId}&select=user_id`)
      if (Array.isArray(existing) && existing.length > 0) {
        if (existing[0].user_id && existing[0].user_id !== currentUserId) {
          throw new Error('Anda tidak memiliki izin untuk mengedit review ini.')
        }
      }

      const res = await apiClient.patch(
        `/rest/v1/reviews?id=eq.${reviewId}`,
        {
          rating: rating,
          comment: (reviewData.comment || '').trim(),
        },
        { headers: { Prefer: 'return=representation' } },
      )
      return { success: true, data: Array.isArray(res) ? res[0] : res }
    }

    return apiClient.put(`/api/v1/recipes/${reviewId}`, reviewData)
  }

  /**
   * Delete a review (Authorization check: owner only).
   */
  async deleteReview(reviewId) {
    const currentUserId = getUserIdentifier()
    cache.invalidate('reviews:')

    if (IS_SUPABASE) {
      // Check ownership
      const existing = await apiClient.get(`/rest/v1/reviews?id=eq.${reviewId}&select=user_id`)
      if (Array.isArray(existing) && existing.length > 0) {
        if (existing[0].user_id && existing[0].user_id !== currentUserId) {
          throw new Error('Anda tidak memiliki izin untuk menghapus review ini.')
        }
      }

      // Delete associated votes first
      try {
        await apiClient.delete(`/rest/v1/review_votes?review_id=eq.${reviewId}`)
      } catch {
        /* ignore */
      }

      await apiClient.delete(`/rest/v1/reviews?id=eq.${reviewId}`)
      return { success: true }
    }

    return apiClient.delete(`/api/v1/reviews/${reviewId}`)
  }

  /**
   * Vote on a review (+1 for upvote, -1 for downvote).
   * Toggles off if clicking the same vote again. Updates row if changing vote.
   * UNIQUE (user_id, review_id).
   */
  async voteReview(reviewId, voteValue) {
    const currentUserId = getUserIdentifier()
    const value = voteValue === 1 ? 1 : -1
    cache.invalidate('reviews:')

    if (IS_SUPABASE) {
      try {
        // Check existing vote
        const existing = await apiClient.get(
          `/rest/v1/review_votes?review_id=eq.${reviewId}&user_id=eq.${currentUserId}&select=*`,
        )

        if (Array.isArray(existing) && existing.length > 0) {
          const currentVote = existing[0]
          if (currentVote.value === value) {
            // Toggle off: delete vote
            await apiClient.delete(`/rest/v1/review_votes?id=eq.${currentVote.id}`)
            return { success: true, userVote: 0 }
          } else {
            // Update to new value
            await apiClient.patch(
              `/rest/v1/review_votes?id=eq.${currentVote.id}`,
              { value, updated_at: new Date().toISOString() },
            )
            return { success: true, userVote: value }
          }
        } else {
          // Insert new vote row
          await apiClient.post('/rest/v1/review_votes', {
            review_id: Number(reviewId),
            user_id: currentUserId,
            value,
          })
          return { success: true, userVote: value }
        }
      } catch (err) {
        console.warn('voteReview error:', err)
        throw err
      }
    }

    return { success: true, userVote: value }
  }
}

export default new ReviewService()
