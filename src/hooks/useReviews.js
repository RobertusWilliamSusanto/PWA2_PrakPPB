import { useState, useEffect, useCallback } from 'react'
import reviewService from '../services/reviewService'

// ---------------------------------------------------------------------------
// useReviews — fetch reviews for a specific product.
// ---------------------------------------------------------------------------

export function useReviews(gunId) {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchReviews = useCallback(async () => {
    if (!gunId) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError(null)

      const response = await reviewService.getReviews(gunId)

      if (response.success) {
        setReviews(response.data || [])
      } else {
        setError(response.message || 'Failed to fetch reviews.')
      }
    } catch (err) {
      setError(err.message || 'An error occurred while fetching reviews.')
      setReviews([])
    } finally {
      setLoading(false)
    }
  }, [gunId])

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  return { reviews, setReviews, loading, error, refetch: fetchReviews }
}

// ---------------------------------------------------------------------------
// useCreateReview — submit a new review for a product.
// ---------------------------------------------------------------------------

export function useCreateReview() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const createReview = async (gunId, reviewData) => {
    try {
      setLoading(true)
      setError(null)
      setSuccess(false)

      const response = await reviewService.createReview(gunId, reviewData)

      if (response.success) {
        setSuccess(true)
        return response.data
      } else {
        setError(response.message || 'Failed to submit review.')
        return null
      }
    } catch (err) {
      setError(err.message || 'An error occurred while submitting review.')
      return null
    } finally {
      setLoading(false)
    }
  }

  return { createReview, loading, error, success }
}

// ---------------------------------------------------------------------------
// useUpdateReview — update an existing review.
// ---------------------------------------------------------------------------

export function useUpdateReview() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const updateReview = async (reviewId, reviewData) => {
    try {
      setLoading(true)
      setError(null)
      const response = await reviewService.updateReview(reviewId, reviewData)
      return response.success ? response.data : null
    } catch (err) {
      setError(err.message || 'Failed to update review.')
      return null
    } finally {
      setLoading(false)
    }
  }

  return { updateReview, loading, error }
}

// ---------------------------------------------------------------------------
// useDeleteReview — delete an existing review.
// ---------------------------------------------------------------------------

export function useDeleteReview() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const deleteReview = async (reviewId) => {
    try {
      setLoading(true)
      setError(null)
      const response = await reviewService.deleteReview(reviewId)
      return response.success
    } catch (err) {
      setError(err.message || 'Failed to delete review.')
      return false
    } finally {
      setLoading(false)
    }
  }

  return { deleteReview, loading, error }
}

// ---------------------------------------------------------------------------
// useVoteReview — toggle thumbs up / thumbs down with debounce.
// ---------------------------------------------------------------------------

export function useVoteReview() {
  const [votingId, setVotingId] = useState(null)

  const voteReview = async (reviewId, voteValue) => {
    try {
      setVotingId(reviewId)
      const result = await reviewService.voteReview(reviewId, voteValue)
      return result
    } catch (err) {
      console.error('Failed to vote review:', err)
      return null
    } finally {
      setVotingId(null)
    }
  }

  return { voteReview, votingId }
}
