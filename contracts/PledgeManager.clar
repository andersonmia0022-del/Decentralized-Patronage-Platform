(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-AMOUNT u101)
(define-constant ERR-INVALID-INTERVAL u102)
(define-constant ERR-INVALID-DURATION u103)
(define-constant ERR-INVALID-START-BLOCK u104)
(define-constant ERR-PLEDGE-ALREADY-EXISTS u105)
(define-constant ERR-PLEDGE-NOT-FOUND u106)
(define-constant ERR-PLEDGE-INACTIVE u107)
(define-constant ERR-INSUFFICIENT-FUNDS u108)
(define-constant ERR-PAYMENT-NOT-DUE u109)
(define-constant ERR-INVALID-CREATOR u110)
(define-constant ERR-INVALID-PATRON u111)
(define-constant ERR-MAX-PLEDGES-EXCEEDED u112)
(define-constant ERR-INVALID-UPDATE-PARAM u113)
(define-constant ERR-ESCROW-NOT-SET u114)
(define-constant ERR-INVALID-PERK-THRESHOLD u115)
(define-constant ERR-INVALID-CURRENCY u116)
(define-constant ERR-INVALID-STATUS u117)
(define-constant ERR-INVALID-GRACE-PERIOD u118)
(define-constant ERR-INVALID-PENALTY u119)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u120)

(define-data-var next-pledge-id uint u0)
(define-data-var max-pledges uint u10000)
(define-data-var min-amount uint u10)
(define-data-var default-interval uint u4320)
(define-data-var escrow-contract (optional principal) none)
(define-data-var authority-contract (optional principal) none)

(define-map pledges
  uint
  {
    patron: principal,
    creator: principal,
    amount: uint,
    interval: uint,
    start-block: uint,
    duration: uint,
    payments-made: uint,
    last-payment-block: uint,
    active: bool,
    currency: (string-utf8 20),
    grace-period: uint,
    penalty-rate: uint,
    perk-threshold: uint
  }
)

(define-map pledges-by-patron
  principal
  (list 100 uint)
)

(define-map pledges-by-creator
  principal
  (list 100 uint)
)

(define-map pledge-updates
  uint
  {
    update-amount: uint,
    update-interval: uint,
    update-duration: uint,
    update-timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-pledge (id uint))
  (map-get? pledges id)
)

(define-read-only (get-pledge-updates (id uint))
  (map-get? pledge-updates id)
)

(define-read-only (get-pledges-for-patron (patron principal))
  (default-to (list) (map-get? pledges-by-patron patron))
)

(define-read-only (get-pledges-for-creator (creator principal))
  (default-to (list) (map-get? pledges-by-creator creator))
)

(define-private (validate-amount (amount uint))
  (if (>= amount (var-get min-amount))
      (ok true)
      (err ERR-INVALID-AMOUNT))
)

(define-private (validate-interval (interval uint))
  (if (> interval u0)
      (ok true)
      (err ERR-INVALID-INTERVAL))
)

(define-private (validate-duration (duration uint))
  (if (> duration u0)
      (ok true)
      (err ERR-INVALID-DURATION))
)

(define-private (validate-start-block (start uint))
  (if (>= start block-height)
      (ok true)
      (err ERR-INVALID-START-BLOCK))
)

(define-private (validate-creator (creator principal))
  (if (not (is-eq creator tx-sender))
      (ok true)
      (err ERR-INVALID-CREATOR))
)

(define-private (validate-currency (cur (string-utf8 20)))
  (if (or (is-eq cur "STX") (is-eq cur "USD") (is-eq cur "BTC"))
      (ok true)
      (err ERR-INVALID-CURRENCY))
)

(define-private (validate-grace-period (period uint))
  (if (<= period u30)
      (ok true)
      (err ERR-INVALID-GRACE-PERIOD))
)

(define-private (validate-penalty-rate (rate uint))
  (if (<= rate u100)
      (ok true)
      (err ERR-INVALID-PENALTY))
)

(define-private (validate-perk-threshold (threshold uint))
  (if (> threshold u0)
      (ok true)
      (err ERR-INVALID-PERK-THRESHOLD))
)

(define-private (is-payment-due (pledge {patron: principal, creator: principal, amount: uint, interval: uint, start-block: uint, duration: uint, payments-made: uint, last-payment-block: uint, active: bool, currency: (string-utf8 20), grace-period: uint, penalty-rate: uint, perk-threshold: uint}))
  (let ((next-due (+ (get last-payment-block pledge) (get interval pledge))))
    (if (and (>= block-height next-due) (< (get payments-made pledge) (get duration pledge)))
        (ok true)
        (err ERR-PAYMENT-NOT-DUE))
  )
)

(define-public (set-escrow-contract (contract-principal principal))
  (begin
    (asserts! (is-eq tx-sender contract-caller) (err ERR-NOT-AUTHORIZED))
    (var-set escrow-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (asserts! (is-eq tx-sender contract-caller) (err ERR-NOT-AUTHORIZED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-min-amount (new-min uint))
  (begin
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set min-amount new-min)
    (ok true)
  )
)

(define-public (create-pledge
  (creator principal)
  (amount uint)
  (interval uint)
  (start-block uint)
  (duration uint)
  (currency (string-utf8 20))
  (grace-period uint)
  (penalty-rate uint)
  (perk-threshold uint)
)
  (let (
        (next-id (var-get next-pledge-id))
        (patron tx-sender)
      )
    (asserts! (< next-id (var-get max-pledges)) (err ERR-MAX-PLEDGES-EXCEEDED))
    (try! (validate-creator creator))
    (try! (validate-amount amount))
    (try! (validate-interval interval))
    (try! (validate-duration duration))
    (try! (validate-start-block start-block))
    (try! (validate-currency currency))
    (try! (validate-grace-period grace-period))
    (try! (validate-penalty-rate penalty-rate))
    (try! (validate-perk-threshold perk-threshold))
    (asserts! (is-some (var-get escrow-contract)) (err ERR-ESCROW-NOT-SET))
    (map-set pledges next-id
      {
        patron: patron,
        creator: creator,
        amount: amount,
        interval: interval,
        start-block: start-block,
        duration: duration,
        payments-made: u0,
        last-payment-block: start-block,
        active: true,
        currency: currency,
        grace-period: grace-period,
        penalty-rate: penalty-rate,
        perk-threshold: perk-threshold
      }
    )
    (map-set pledges-by-patron patron (cons next-id (default-to (list) (map-get? pledges-by-patron patron))))
    (map-set pledges-by-creator creator (cons next-id (default-to (list) (map-get? pledges-by-creator creator))))
    (var-set next-pledge-id (+ next-id u1))
    (print { event: "pledge-created", id: next-id, patron: patron, creator: creator })
    (ok next-id)
  )
)

(define-public (update-pledge
  (pledge-id uint)
  (new-amount uint)
  (new-interval uint)
  (new-duration uint)
)
  (let ((pledge (map-get? pledges pledge-id)))
    (match pledge
      p
        (begin
          (asserts! (is-eq (get patron p) tx-sender) (err ERR-NOT-AUTHORIZED))
          (asserts! (get active p) (err ERR-PLEDGE-INACTIVE))
          (try! (validate-amount new-amount))
          (try! (validate-interval new-interval))
          (try! (validate-duration new-duration))
          (map-set pledges pledge-id
            (merge p {
              amount: new-amount,
              interval: new-interval,
              duration: new-duration
            })
          )
          (map-set pledge-updates pledge-id
            {
              update-amount: new-amount,
              update-interval: new-interval,
              update-duration: new-duration,
              update-timestamp: block-height,
              updater: tx-sender
            }
          )
          (print { event: "pledge-updated", id: pledge-id })
          (ok true)
        )
      (err ERR-PLEDGE-NOT-FOUND)
    )
  )
)

(define-public (cancel-pledge (pledge-id uint))
  (let ((pledge (map-get? pledges pledge-id)))
    (match pledge
      p
        (begin
          (asserts! (is-eq (get patron p) tx-sender) (err ERR-NOT-AUTHORIZED))
          (asserts! (get active p) (err ERR-PLEDGE-INACTIVE))
          (map-set pledges pledge-id (merge p { active: false }))
          (print { event: "pledge-canceled", id: pledge-id })
          (ok true)
        )
      (err ERR-PLEDGE-NOT-FOUND)
    )
  )
)

(define-public (execute-payment (pledge-id uint))
  (let ((pledge (map-get? pledges pledge-id)))
    (match pledge
      p
        (begin
          (asserts! (get active p) (err ERR-PLEDGE-INACTIVE))
          (try! (is-payment-due p))
          (asserts! (is-some (var-get escrow-contract)) (err ERR-ESCROW-NOT-SET))
          (let (
                (escrow (unwrap! (var-get escrow-contract) (err ERR-ESCROW-NOT-SET)))
                (transfer-result (as-contract (stx-transfer? (get amount p) escrow (get creator p))))
              )
            (try! transfer-result)
          )
          (map-set pledges pledge-id
            (merge p {
              payments-made: (+ (get payments-made p) u1),
              last-payment-block: block-height
            })
          )
          (print { event: "payment-executed", id: pledge-id, amount: (get amount p) })
          (ok true)
        )
      (err ERR-PLEDGE-NOT-FOUND)
    )
  )
)

(define-public (get-pledge-count)
  (ok (var-get next-pledge-id))
)