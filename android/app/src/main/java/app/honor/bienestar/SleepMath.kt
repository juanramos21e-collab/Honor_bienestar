package app.honor.bienestar

import java.time.Duration
import java.time.Instant

internal object SleepMath {
    data class Interval(val start: Instant, val end: Instant)
    fun hours(intervals: List<Interval>): Double {
        val sorted = intervals.filter { it.end > it.start }.sortedBy { it.start }
        if (sorted.isEmpty()) return 0.0
        var start = sorted.first().start
        var end = sorted.first().end
        var seconds = 0L
        for (next in sorted.drop(1)) {
            if (next.start <= end) { if (next.end > end) end = next.end }
            else { seconds += Duration.between(start, end).seconds; start = next.start; end = next.end }
        }
        return (seconds + Duration.between(start, end).seconds) / 3600.0
    }
}
