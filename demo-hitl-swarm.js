/**
 * Demo: HITL (Human-in-the-Loop) Integration with RevOps Swarm
 * Shows how human approval is required before executing critical decisions
 */

const { EventEmitter } = require('events');

// Simulated HITL Manager
class HITLManager extends EventEmitter {
    constructor() {
        super();
        this.pendingReviews = new Map();
        this.reviewHistory = [];
        this.confidenceThreshold = 70; // Below this requires human review
    }

    async requestReview(decision) {
        const reviewId = `REVIEW-${Date.now()}`;
        const review = {
            id: reviewId,
            decision,
            requestedAt: new Date(),
            status: 'pending',
            priority: this.calculatePriority(decision)
        };

        this.pendingReviews.set(reviewId, review);
        this.emit('review-requested', review);

        console.log(`\n🔔 HUMAN REVIEW REQUESTED`);
        console.log(`   Review ID: ${reviewId}`);
        console.log(`   Priority: ${review.priority.toUpperCase()}`);
        console.log(`   Decision: ${decision.description}`);
        console.log(`   Confidence: ${decision.confidence}% (below ${this.confidenceThreshold}% threshold)`);
        
        return reviewId;
    }

    calculatePriority(decision) {
        if (decision.type === 'emergency') return 'critical';
        if (decision.value > 100000) return 'high';
        if (decision.confidence < 50) return 'high';
        return 'medium';
    }

    async simulateHumanReview(reviewId, action = 'approve', feedback = null) {
        const review = this.pendingReviews.get(reviewId);
        if (!review) throw new Error('Review not found');

        review.status = action;
        review.reviewedAt = new Date();
        review.reviewTime = (review.reviewedAt - review.requestedAt) / 1000; // seconds
        review.feedback = feedback;

        this.reviewHistory.push(review);
        this.pendingReviews.delete(reviewId);

        console.log(`\n✅ HUMAN REVIEW COMPLETED`);
        console.log(`   Action: ${action.toUpperCase()}`);
        console.log(`   Review Time: ${review.reviewTime}s`);
        if (feedback) console.log(`   Feedback: ${feedback}`);

        this.emit('review-completed', review);
        return review;
    }

    getMetrics() {
        const completed = this.reviewHistory.length;
        const approved = this.reviewHistory.filter(r => r.status === 'approve').length;
        const avgTime = completed > 0 
            ? this.reviewHistory.reduce((sum, r) => sum + r.reviewTime, 0) / completed
            : 0;

        return {
            pendingReviews: this.pendingReviews.size,
            completedReviews: completed,
            approvalRate: completed > 0 ? (approved / completed * 100).toFixed(1) : 0,
            avgReviewTime: avgTime.toFixed(1)
        };
    }
}

// Enhanced Queen Agent with HITL
class QueenWithHITL extends EventEmitter {
    constructor(hitlManager) {
        super();
        this.hitlManager = hitlManager;
        this.agents = new Map();
    }

    async makeDecision(topic, context, votes) {
        // Calculate average confidence
        const avgConfidence = votes.reduce((sum, v) => sum + v.confidence, 0) / votes.length;
        
        const decision = {
            topic,
            description: topic,
            votes,
            confidence: Math.round(avgConfidence),
            recommendation: this.determineBestOption(votes),
            type: context.type || 'standard',
            value: context.value || 0
        };

        console.log(`\n👑 Queen evaluating decision...`);
        console.log(`   Average Confidence: ${decision.confidence}%`);
        console.log(`   Recommendation: ${decision.recommendation}`);

        // Check if human review is needed
        if (decision.confidence < this.hitlManager.confidenceThreshold) {
            console.log(`   ⚠️  Confidence below threshold - escalating to human`);
            
            const reviewId = await this.hitlManager.requestReview(decision);
            decision.reviewId = reviewId;
            decision.status = 'pending_human_review';
            
            return decision;
        }

        console.log(`   ✅ Confidence sufficient - auto-approving`);
        decision.status = 'auto_approved';
        return decision;
    }

    determineBestOption(votes) {
        // Group votes by option
        const voteCount = {};
        votes.forEach(vote => {
            voteCount[vote.choice] = (voteCount[vote.choice] || 0) + 1;
        });

        // Find option with most votes
        return Object.entries(voteCount)
            .sort((a, b) => b[1] - a[1])[0][0];
    }
}

// Demo execution
async function runHITLDemo() {
    console.log(`╔═══════════════════════════════════════════════════════════════╗`);
    console.log(`║         HITL-ENABLED REVENUE OPERATIONS SYSTEM                ║`);
    console.log(`║         Human-in-the-Loop Decision Making                     ║`);
    console.log(`╚═══════════════════════════════════════════════════════════════╝\n`);

    const hitlManager = new HITLManager();
    const queen = new QueenWithHITL(hitlManager);

    // Scenario 1: High confidence decision (auto-approved)
    console.log(`\n📋 SCENARIO 1: Routine Pipeline Optimization`);
    console.log(`The sales pipeline needs routine optimization.`);

    const highConfidenceVotes = [
        { agent: 'CRM', choice: 'automate-follow-ups', confidence: 85 },
        { agent: 'Marketing', choice: 'automate-follow-ups', confidence: 82 },
        { agent: 'Analytics', choice: 'automate-follow-ups', confidence: 88 },
        { agent: 'Process', choice: 'automate-follow-ups', confidence: 79 }
    ];

    const decision1 = await queen.makeDecision(
        'Optimize sales pipeline automation',
        { type: 'standard', value: 25000 },
        highConfidenceVotes
    );

    // Scenario 2: Low confidence decision (requires human review)
    console.log(`\n\n📋 SCENARIO 2: Major Client Retention Crisis`);
    console.log(`ABC Corp (worth $500K/year) is showing churn signals.`);

    const lowConfidenceVotes = [
        { agent: 'CRM', choice: 'executive-intervention', confidence: 72 },
        { agent: 'Marketing', choice: 'retention-campaign', confidence: 65 },
        { agent: 'Analytics', choice: 'wait-gather-data', confidence: 58 },
        { agent: 'Process', choice: 'executive-intervention', confidence: 77 }
    ];

    const decision2 = await queen.makeDecision(
        'Prevent ABC Corp churn - $500K at risk',
        { type: 'emergency', value: 500000 },
        lowConfidenceVotes
    );

    // Simulate human reviewing the critical decision
    if (decision2.reviewId) {
        console.log(`\n⏳ Waiting for human review...`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate review time

        await hitlManager.simulateHumanReview(
            decision2.reviewId,
            'approve',
            'Proceed with executive intervention but also prepare retention offer'
        );

        console.log(`\n🚀 Executing approved action: Executive intervention with retention package`);
    }

    // Scenario 3: Model uncertainty (requires human input)
    console.log(`\n\n📋 SCENARIO 3: New Market Expansion Decision`);
    console.log(`Considering expansion into APAC market.`);

    const uncertainVotes = [
        { agent: 'CRM', choice: 'expand-now', confidence: 45 },
        { agent: 'Marketing', choice: 'wait-6-months', confidence: 52 },
        { agent: 'Analytics', choice: 'need-more-data', confidence: 38 },
        { agent: 'Process', choice: 'expand-now', confidence: 49 }
    ];

    const decision3 = await queen.makeDecision(
        'APAC market expansion strategy',
        { type: 'strategic', value: 2000000 },
        uncertainVotes
    );

    // Simulate human review with modification
    if (decision3.reviewId) {
        console.log(`\n⏳ Waiting for human review...`);
        await new Promise(resolve => setTimeout(resolve, 1500));

        await hitlManager.simulateHumanReview(
            decision3.reviewId,
            'modify',
            'Conduct 3-month pilot in Singapore first, then reassess'
        );

        console.log(`\n🔄 Executing modified plan: 3-month Singapore pilot program`);
    }

    // Display HITL metrics
    console.log(`\n\n📊 HITL SYSTEM METRICS`);
    console.log(`========================================`);
    const metrics = hitlManager.getMetrics();
    console.log(`Completed Reviews: ${metrics.completedReviews}`);
    console.log(`Approval Rate: ${metrics.approvalRate}%`);
    console.log(`Average Review Time: ${metrics.avgReviewTime}s`);
    console.log(`\n✅ HITL Demo completed successfully!`);
}

// Run the demo
runHITLDemo().catch(console.error);