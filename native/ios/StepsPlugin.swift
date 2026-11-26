// Daily step counts from Apple Health, for the food targets and QK's weekly report.
// NOT YET COMPILED: build on a Mac with Xcode (see native/README.md, "Steps").
// Needs the HealthKit capability and NSHealthShareUsageDescription in Info.plist.
import Capacitor
import HealthKit

@objc(StepsPlugin)
public class StepsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StepsPlugin"
    public let jsName = "Steps"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "dailySteps", returnType: CAPPluginReturnPromise)]
    private let store = HKHealthStore()

    /// { days: 7 } → { days: [{ date: "2026-11-20", steps: 8421 }, …] }, oldest first.
    @objc func dailySteps(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable(), let type = HKQuantityType.quantityType(forIdentifier: .stepCount) else {
            call.reject("Health data unavailable"); return
        }
        let days = max(1, min(60, call.getInt("days") ?? 7))
        store.requestAuthorization(toShare: nil, read: [type]) { _, _ in
            let cal = Calendar.current, end = Date()
            let start = cal.startOfDay(for: cal.date(byAdding: .day, value: -(days - 1), to: end)!)
            let q = HKStatisticsCollectionQuery(quantityType: type,
                                                quantitySamplePredicate: HKQuery.predicateForSamples(withStart: start, end: end),
                                                options: .cumulativeSum, anchorDate: start, intervalComponents: DateComponents(day: 1))
            q.initialResultsHandler = { _, results, error in
                if let error = error { call.reject(error.localizedDescription); return }
                let fmt = DateFormatter(); fmt.dateFormat = "yyyy-MM-dd"
                var out: [[String: Any]] = []
                results?.enumerateStatistics(from: start, to: end) { s, _ in
                    out.append(["date": fmt.string(from: s.startDate), "steps": Int(s.sumQuantity()?.doubleValue(for: .count()) ?? 0)])
                }
                call.resolve(["days": out])
            }
            self.store.execute(q)
        }
    }
}
