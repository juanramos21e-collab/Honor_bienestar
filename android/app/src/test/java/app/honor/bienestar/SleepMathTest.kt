package app.honor.bienestar

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Instant

class SleepMathTest {
    private fun interval(start: String, end: String) = SleepMath.Interval(Instant.parse(start), Instant.parse(end))
    @Test fun mergesOverlappingSessionsWithoutCountingTwice() {
        val values = listOf(interval("2026-10-01T23:00:00Z", "2026-10-02T03:00:00Z"), interval("2026-10-02T02:00:00Z", "2026-10-02T06:00:00Z"))
        assertEquals(7.0, SleepMath.hours(values), .00001)
    }
    @Test fun preservesGapsAndIgnoresInvalidIntervals() {
        val values = listOf(interval("2026-10-02T02:00:00Z", "2026-10-02T03:30:00Z"), interval("2026-10-02T05:00:00Z", "2026-10-02T06:00:00Z"), interval("2026-10-02T08:00:00Z", "2026-10-02T07:00:00Z"))
        assertEquals(2.5, SleepMath.hours(values), .00001)
    }
    @Test fun usesElapsedTimeAcrossTimezoneClockChanges() {
        val values = listOf(interval("2026-11-01T01:00:00-04:00", "2026-11-01T02:00:00-05:00"))
        assertEquals(2.0, SleepMath.hours(values), .00001); assertEquals(0.0, SleepMath.hours(emptyList()), .00001)
    }
}
