# Smoke test for Tick Worth API (run against a freshly seeded dev DB).
# Usage: powershell -File scripts/smoke-test.ps1
$ErrorActionPreference = 'Stop'
$base = 'http://localhost:5001/api'
$script:pass = 0; $script:fail = 0

function Assert($cond, $name) {
  if ($cond) { $script:pass++; Write-Host "PASS  $name" }
  else { $script:fail++; Write-Host "FAIL  $name" -ForegroundColor Red }
}

function Login($email) {
  (Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType 'application/json' `
    -Body (@{ email = $email; password = 'password123' } | ConvertTo-Json)).token
}

function Call($method, $path, $token, $body) {
  $headers = @{ Authorization = "Bearer $token" }
  if ($null -ne $body) {
    Invoke-RestMethod -Method $method -Uri "$base$path" -Headers $headers -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 5)
  } else {
    Invoke-RestMethod -Method $method -Uri "$base$path" -Headers $headers
  }
}

# Expect an HTTP error with a given status code.
function CallExpect($method, $path, $token, $body, $expectedStatus, $name) {
  try {
    Call $method $path $token $body | Out-Null
    Assert $false "$name (expected $expectedStatus, got success)"
  } catch {
    $status = $_.Exception.Response.StatusCode.value__
    Assert ($status -eq $expectedStatus) "$name (got $status)"
  }
}

$customer  = Login 'customer@tickworth.test'
$shop      = Login 'shop@tickworth.test'
$warehouse = Login 'warehouse@tickworth.test'
$owner     = Login 'owner@tickworth.test'
Assert ($customer -and $shop -and $warehouse -and $owner) 'login all 4 roles'

$products = Invoke-RestMethod "$base/products"
# Pick products that actually have shop stock (the seed deliberately leaves a
# couple out of stock to demo pre-booking/requests).
$inStock = @($products | Where-Object { ($_.stock | Where-Object location -eq 'SHOP').quantity -ge 6 })
$p1 = $inStock[0]; $p2 = $inStock[1]
$p1ShopBefore = ($p1.stock | Where-Object location -eq 'SHOP').quantity

# --- UC3/UC8: place order, status lifecycle ---
$order = Call Post '/orders' $customer @{ channel='ONLINE'; paymentMethod='COD'; shippingAddress='1 Test St'; items=@(@{ productId=$p1.id; quantity=2 }) }
Assert ($order.status -eq 'PENDING') 'online order created PENDING'
Assert ($order.totalCents -eq 2 * $p1.priceCents) 'totalCents from server prices'

$p1After = Invoke-RestMethod "$base/products/$($p1.id)"
$p1ShopAfter = ($p1After.stock | Where-Object location -eq 'SHOP').quantity
Assert ($p1ShopAfter -eq $p1ShopBefore - 2) 'SHOP stock decremented by 2'

Assert ($order.orderNumber -match '^TW-\d{6}$') 'order has human-readable order number'
$courier1 = (Call Get '/couriers' $shop $null)[0]
CallExpect Patch "/orders/$($order.id)/status" $shop @{ status='DELIVERED' } 409 'invalid transition PENDING->DELIVERED rejected'
CallExpect Patch "/orders/$($order.id)/status" $customer @{ status='PAID' } 403 'customer cannot set order status (403)'
$o = Call Patch "/orders/$($order.id)/status" $shop @{ status='PAID' }
Assert ($o.status -eq 'PAID' -and $o.paymentConfirmed -eq $true) 'PENDING->PAID sets paymentConfirmed'
# Dispatching a delivery order requires a courier.
CallExpect Patch "/orders/$($order.id)/status" $shop @{ status='DISPATCHED' } 400 'dispatch without courier rejected (400)'
$o = Call Patch "/orders/$($order.id)/status" $shop @{ status='DISPATCHED'; courierId=$courier1.id }
Assert ($o.status -eq 'DISPATCHED' -and $o.courier.id -eq $courier1.id) 'dispatch assigns courier + contact'
$o = Call Patch "/orders/$($order.id)/status" $shop @{ status='DELIVERED' }
Assert ($o.status -eq 'DELIVERED') 'full lifecycle PAID->DISPATCHED(courier)->DELIVERED'
CallExpect Post "/orders/$($order.id)/cancel" $customer $null 409 'cancel after dispatch rejected (409)'

# --- UC3: cancel restores stock ---
$order2 = Call Post '/orders' $customer @{ channel='ONLINE'; paymentMethod='ONLINE'; shippingAddress='1 Test St'; items=@(@{ productId=$p2.id; quantity=1 }) }
$before = (Invoke-RestMethod "$base/products/$($p2.id)").stock | Where-Object location -eq 'SHOP'
$cancelled = Call Post "/orders/$($order2.id)/cancel" $customer $null
Assert ($cancelled.status -eq 'CANCELLED') 'customer cancels own order'
$after = (Invoke-RestMethod "$base/products/$($p2.id)").stock | Where-Object location -eq 'SHOP'
Assert ($after.quantity -eq $before.quantity + 1) 'cancel restored SHOP stock'
CallExpect Post "/orders/$($order2.id)/cancel" $customer $null 409 'double-cancel rejected'

# --- UC5: inventory + RBAC ---
CallExpect Get '/inventory' $customer $null 403 'customer blocked from inventory (403)'
$inv = Call Get '/inventory?location=SHOP' $shop $null
Assert ($inv.Count -gt 0 -and ($inv | Where-Object location -ne 'SHOP').Count -eq 0) 'inventory filtered by location'
$low = Call Get '/inventory/low-stock' $shop $null
Assert ($null -ne $low) 'low-stock endpoint responds'

# --- UC6: transfers + RBAC ---
CallExpect Post '/transfers' $customer @{ productId=$p1.id; from='WAREHOUSE'; to='SHOP'; qty=1 } 403 'customer blocked from transfers'
CallExpect Post '/transfers' $shop @{ productId=$p1.id; from='WAREHOUSE'; to='SHOP'; qty=1 } 403 'shopkeeper blocked from WAREHOUSE-sourced transfer'
$whBefore = (Call Get "/inventory?location=WAREHOUSE" $warehouse $null) | Where-Object productId -eq $p1.id
$mv = Call Post '/transfers' $warehouse @{ productId=$p1.id; from='WAREHOUSE'; to='SHOP'; qty=5 }
Assert ($mv.type -eq 'TRANSFER') 'warehouse->shop transfer creates TRANSFER movement'
$whAfter = (Call Get "/inventory?location=WAREHOUSE" $warehouse $null) | Where-Object productId -eq $p1.id
Assert ($whAfter.quantity -eq $whBefore.quantity - 5) 'warehouse stock decremented by 5'
CallExpect Post '/transfers' $warehouse @{ productId=$p1.id; from='WAREHOUSE'; to='SHOP'; qty=9999 } 409 'oversell transfer rejected (409)'
CallExpect Post '/transfers' $shop @{ productId=$p1.id; from='SHOP'; to='SHOP'; qty=1 } 400 'from==to rejected (400)'
$mv2 = Call Post '/transfers' $shop @{ productId=$p1.id; from='SHOP'; to='REPAIR'; qty=1 }
Assert ($mv2.type -eq 'TRANSFER') 'shopkeeper can do SHOP->REPAIR transfer'

# --- UC7: damage + repair lifecycle ---
$shopBefore = ((Invoke-RestMethod "$base/products/$($p1.id)").stock | Where-Object location -eq 'SHOP').quantity
$dr = Call Post '/damage-reports' $shop @{ productId=$p1.id; location='SHOP'; quantity=2; description='Cracked crystal' }
Assert ($dr.status -eq 'REPORTED') 'damage report created REPORTED'
$shopAfterDmg = ((Invoke-RestMethod "$base/products/$($p1.id)").stock | Where-Object location -eq 'SHOP').quantity
Assert ($shopAfterDmg -eq $shopBefore - 2) 'damage decremented SHOP by 2'
CallExpect Patch "/damage-reports/$($dr.id)" $shop @{ status='REPAIRED' } 409 'REPORTED->REPAIRED skip rejected'
$dr = Call Patch "/damage-reports/$($dr.id)" $shop @{ status='IN_REPAIR' }
$repairBefore = ((Invoke-RestMethod "$base/products/$($p1.id)").stock | Where-Object location -eq 'REPAIR').quantity
$dr = Call Patch "/damage-reports/$($dr.id)" $shop @{ status='REPAIRED' }
$stockNow = (Invoke-RestMethod "$base/products/$($p1.id)").stock
Assert ((($stockNow | Where-Object location -eq 'REPAIR').quantity) -eq $repairBefore - 2) 'REPAIRED moved units out of REPAIR'
Assert ((($stockNow | Where-Object location -eq 'SHOP').quantity) -eq $shopAfterDmg + 2) 'REPAIRED moved units into SHOP'
# scrap path
$dr2 = Call Post '/damage-reports' $shop @{ productId=$p2.id; location='SHOP'; quantity=1; description='Bent lugs' }
$dr2 = Call Patch "/damage-reports/$($dr2.id)" $shop @{ status='SCRAPPED' }
Assert ($dr2.status -eq 'SCRAPPED') 'REPORTED->SCRAPPED allowed'
$reports = Call Get '/damage-reports' $shop $null
Assert ($reports.Count -ge 2 -and $null -ne $reports[0].product) 'damage list includes product info'

# --- UC9: reports + notifications ---
CallExpect Get '/reports/monthly?year=2026&month=6' $shop $null 403 'shopkeeper blocked from monthly report'
$report = Call Get '/reports/monthly?year=2026&month=6' $owner $null
Assert ($report.orderCount -ge 1 -and $report.totalRevenueCents -ge $order.totalCents) 'monthly report counts revenue orders'
Assert (($report.topProducts | Measure-Object).Count -ge 1) 'monthly report has top products'
$send = Call Post '/reports/send-owner' $shop $null
Assert ($send.id -and $send.kind -eq 'SHOPKEEPER') 'shopkeeper send-owner persists a SHOPKEEPER report'

$notifs = Call Get '/notifications' $owner $null
$reportNotif = $notifs | Where-Object type -eq 'REPORT' | Select-Object -First 1
Assert ($null -ne $reportNotif) 'owner received REPORT notification'
$read = Call Patch "/notifications/$($reportNotif.id)/read" $owner $null
Assert ($read.read -eq $true) 'mark notification read'
CallExpect Patch "/notifications/$($reportNotif.id)/read" $customer $null 404 'cannot mark someone else''s notification'

# --- low-stock notification on crossing reorder level ---
# p2 SHOP started at 6 (reorder 3); order 1 + damage 1 took it to 4 minus cancel restore +1 = 5. Order 2 to cross to 3.
$p2Shop = ((Invoke-RestMethod "$base/products/$($p2.id)").stock | Where-Object location -eq 'SHOP')
$toCross = $p2Shop.quantity - $p2Shop.reorderLevel
$null = Call Post '/orders' $customer @{ channel='ONLINE'; paymentMethod='COD'; shippingAddress='1 Test St'; items=@(@{ productId=$p2.id; quantity=$toCross }) }
$shopNotifs = Call Get '/notifications' $shop $null
$lowNotif = $shopNotifs | Where-Object type -eq 'LOW_STOCK' | Select-Object -First 1
Assert ($null -ne $lowNotif) 'LOW_STOCK notification emitted on crossing reorder level'
$low2 = Call Get '/inventory/low-stock' $shop $null
Assert (@($low2 | Where-Object { $_.productId -eq $p2.id -and $_.location -eq 'SHOP' }).Count -eq 1) 'low-stock list includes the depleted item'

# --- staff provisioning + RBAC (owner-only user management) ---
CallExpect Get '/users' $shop $null 403 'shopkeeper blocked from user management (403)'
CallExpect Get '/users' $customer $null 403 'customer blocked from user management (403)'
$staffList = Call Get '/users' $owner $null
Assert ($staffList.Count -ge 3) 'owner lists staff accounts'
$newEmail = "clerk_$([guid]::NewGuid().ToString('N').Substring(0,6))@tickworth.test"
$newStaff = Call Post '/users' $owner @{ name='New Clerk'; email=$newEmail; password='password123'; role='SHOPKEEPER' }
Assert ($newStaff.role -eq 'SHOPKEEPER' -and $newStaff.active -eq $true -and $null -eq $newStaff.passwordHash) 'owner creates active staff (no passwordHash leaked)'
$newToken = Login $newEmail
Assert ($null -ne $newToken) 'provisioned staff can log in'
# deactivate then verify login is refused
$null = Call Patch "/users/$($newStaff.id)" $owner @{ active=$false }
CallExpect Post '/auth/login' $null @{ email=$newEmail; password='password123' } 401 'deactivated staff cannot log in (401)'
# owner cannot deactivate self
$ownerId = ($staffList | Where-Object role -eq 'OWNER' | Select-Object -First 1).id
CallExpect Patch "/users/$ownerId" $owner @{ active=$false } 409 'owner cannot deactivate own account (409)'
# self-registration is always a customer (role in body ignored)
$selfEmail = "self_$([guid]::NewGuid().ToString('N').Substring(0,6))@tickworth.test"
$reg = Invoke-RestMethod -Method Post -Uri "$base/auth/register" -ContentType 'application/json' -Body (@{ name='Sneaky User'; email=$selfEmail; password='password123'; role='OWNER' } | ConvertTo-Json)
Assert ($reg.user.role -eq 'CUSTOMER') 'self-registration ignores role and creates CUSTOMER'

# --- warehouse manager has NO order access (RBAC) ---
CallExpect Get '/orders/all' $warehouse $null 403 'warehouse manager blocked from order list (403)'
$someOrder = (Call Get '/orders/all' $shop $null) | Select-Object -First 1
if ($someOrder) {
  CallExpect Patch "/orders/$($someOrder.id)/status" $warehouse @{ status='DISPATCHED' } 403 'warehouse manager blocked from order status (403)'
}

# --- purchase-in (receive stock): warehouse/owner only ---
$whQtyBefore = ((Call Get "/inventory?location=WAREHOUSE" $warehouse $null) | Where-Object productId -eq $p1.id).quantity
CallExpect Post '/inventory/receive' $shop @{ productId=$p1.id; quantity=10 } 403 'shopkeeper blocked from purchase-in (403)'
$pin = Call Post '/inventory/receive' $warehouse @{ productId=$p1.id; quantity=10 }
Assert ($pin.type -eq 'PURCHASE_IN') 'warehouse purchase-in creates PURCHASE_IN movement'
$whQtyAfter = ((Call Get "/inventory?location=WAREHOUSE" $warehouse $null) | Where-Object productId -eq $p1.id).quantity
Assert ($whQtyAfter -eq $whQtyBefore + 10) 'purchase-in incremented WAREHOUSE stock by 10'

# --- UC: delivery options + couriers ---
CallExpect Get '/couriers' $customer $null 403 'customer blocked from couriers (403)'
CallExpect Get '/couriers' $warehouse $null 403 'warehouse manager blocked from couriers (403)'
# EXPRESS adds a delivery fee server-side
$expressOrder = Call Post '/orders' $customer @{ channel='ONLINE'; paymentMethod='COD'; deliveryMethod='EXPRESS'; shippingAddress='9 Fast Ln'; items=@(@{ productId=$p1.id; quantity=1 }) }
Assert ($expressOrder.deliveryFeeCents -gt 0 -and $expressOrder.totalCents -eq $p1.priceCents + $expressOrder.deliveryFeeCents) 'EXPRESS order adds delivery fee to total'
# missing address for a delivery order is rejected
CallExpect Post '/orders' $customer @{ channel='ONLINE'; paymentMethod='COD'; deliveryMethod='STANDARD'; items=@(@{ productId=$p1.id; quantity=1 }) } 400 'delivery order without address rejected (400)'
# PICKUP needs no address and no courier to dispatch
$pickup = Call Post '/orders' $customer @{ channel='ONLINE'; paymentMethod='COD'; deliveryMethod='PICKUP'; items=@(@{ productId=$p1.id; quantity=1 }) }
Assert ($pickup.deliveryMethod -eq 'PICKUP' -and $pickup.deliveryFeeCents -eq 0) 'PICKUP order needs no address, no fee'
$null = Call Patch "/orders/$($pickup.id)/status" $shop @{ status='PAID' }
$pk = Call Patch "/orders/$($pickup.id)/status" $shop @{ status='DISPATCHED' }
Assert ($pk.status -eq 'DISPATCHED' -and $null -eq $pk.courier) 'PICKUP dispatch needs no courier'
# courier management: create + deactivate, then can't assign an inactive courier
$newCourier = Call Post '/couriers' $shop @{ name='Test Rider'; phone='+1-555-0900'; email='rider@swiftship.test' }
Assert ($newCourier.active -eq $true) 'shopkeeper creates courier'
$null = Call Patch "/couriers/$($newCourier.id)" $shop @{ active=$false }
$expressOrder = Call Patch "/orders/$($expressOrder.id)/status" $shop @{ status='PAID' }
CallExpect Patch "/orders/$($expressOrder.id)/status" $shop @{ status='DISPATCHED'; courierId=$newCourier.id } 400 'cannot dispatch with an inactive courier (400)'
$ex = Call Patch "/orders/$($expressOrder.id)/status" $shop @{ status='DISPATCHED'; courierId=$courier1.id }
Assert ($ex.courier.phone) 'active courier assignment exposes contact phone'

# --- UC: out-of-stock requests + pre-booking ---
$allProducts = Invoke-RestMethod "$base/products"
$prebookProd = $allProducts | Where-Object name -eq 'Seamaster 300' | Select-Object -First 1   # SHOP 0, WAREHOUSE 20
$requestProd = $allProducts | Where-Object name -eq 'Khaki Field' | Select-Object -First 1      # SHOP 0, WAREHOUSE 0
Assert (($prebookProd.stock | Where-Object location -eq 'SHOP').quantity -eq 0) 'seeded prebook product is out in shop'
Assert (($requestProd.stock | Where-Object location -eq 'WAREHOUSE').quantity -eq 0) 'seeded request product is out in warehouse'

# In-stock product cannot be requested (just buy it)
CallExpect Post '/stock-requests' $customer @{ productId=$p1.id; quantity=1 } 400 'cannot request an in-stock watch (400)'
# Warehouse-available => PREBOOK
$prebook = Call Post '/stock-requests' $customer @{ productId=$prebookProd.id; quantity=1 }
Assert ($prebook.type -eq 'PREBOOK') 'out-of-shop but warehouse-stocked => PREBOOK'
# Warehouse-empty => REQUEST
$request = Call Post '/stock-requests' $customer @{ productId=$requestProd.id; quantity=1 }
Assert ($request.type -eq 'REQUEST') 'out everywhere => REQUEST only'
# Duplicate open request blocked
CallExpect Post '/stock-requests' $customer @{ productId=$prebookProd.id; quantity=1 } 409 'duplicate open request blocked (409)'
# RBAC: customer cannot see the staff queue
CallExpect Get '/stock-requests' $customer $null 403 'customer blocked from request queue (403)'
$queue = Call Get '/stock-requests' $shop $null
Assert (@($queue | Where-Object status -eq 'OPEN').Count -ge 2) 'shopkeeper sees open request queue'

# Fulfil the PREBOOK -> pulls 1 unit warehouse->shop + notifies customer
$whBeforeFulfil = ($prebookProd.stock | Where-Object location -eq 'WAREHOUSE').quantity
$fulfilled = Call Patch "/stock-requests/$($prebook.id)" $shop @{ action='FULFILL' }
Assert ($fulfilled.status -eq 'FULFILLED') 'prebook fulfilled'
$prebookAfter = Invoke-RestMethod "$base/products/$($prebookProd.id)"
Assert ((($prebookAfter.stock | Where-Object location -eq 'SHOP').quantity) -eq 1) 'fulfil moved a unit into SHOP'
Assert ((($prebookAfter.stock | Where-Object location -eq 'WAREHOUSE').quantity) -eq $whBeforeFulfil - 1) 'fulfil decremented WAREHOUSE'
$custNotifs = Call Get '/notifications' $customer $null
Assert (@($custNotifs | Where-Object type -eq 'STOCK_REQUEST').Count -ge 1) 'customer notified on fulfil'

# Fulfilling the REQUEST (no stock anywhere) fails until restock
CallExpect Patch "/stock-requests/$($request.id)" $shop @{ action='FULFILL' } 400 'cannot fulfil a request with no stock (400)'
$declined = Call Patch "/stock-requests/$($request.id)" $shop @{ action='DECLINE' }
Assert ($declined.status -eq 'DECLINED') 'request can be declined'
# Customer can cancel their own still-open request (make a fresh one first)
$req2 = Call Post '/stock-requests' $customer @{ productId=$requestProd.id; quantity=1 }
$cancelledReq = Call Post "/stock-requests/$($req2.id)/cancel" $customer $null
Assert ($cancelledReq.status -eq 'CANCELLED') 'customer cancels own open request'

# --- UC10: shop -> warehouse restock requests + RBAC ---
CallExpect Get  '/restock-requests' $customer $null 403 'customer blocked from restock queue (403)'
CallExpect Post '/restock-requests' $warehouse @{ items=@(@{ productId=$p1.id; quantity=2 }) } 403 'warehouse manager cannot raise restock asks (403)'
$restock = Call Post '/restock-requests' $shop @{ items=@(@{ productId=$p1.id; quantity=4 }); note='Smoke restock' }
Assert ($restock[0].status -eq 'OPEN' -and $restock[0].quantity -eq 4) 'shopkeeper raises an OPEN restock request'
# A second open ask for the same product collapses into the first (updates qty, no duplicate row)
$restock2 = Call Post '/restock-requests' $shop @{ items=@(@{ productId=$p1.id; quantity=6 }) }
Assert ($restock2[0].id -eq $restock[0].id -and $restock2[0].quantity -eq 6) 'duplicate open restock ask collapses + updates qty'
$rid = $restock2[0].id
CallExpect Patch "/restock-requests/$rid" $shop @{ action='FULFILL' } 403 'shopkeeper cannot fulfil restock (403)'
# Warehouse fulfils a chosen quantity -> guarded WAREHOUSE->SHOP move + movedQty recorded
$whBeforeR   = ((Call Get "/inventory?location=WAREHOUSE" $warehouse $null) | Where-Object productId -eq $p1.id).quantity
$shopBeforeR = ((Call Get "/inventory?location=SHOP" $shop $null)            | Where-Object productId -eq $p1.id).quantity
$ful = Call Patch "/restock-requests/$rid" $warehouse @{ action='FULFILL'; quantity=2 }
Assert ($ful.status -eq 'FULFILLED' -and $ful.movedQty -eq 2) 'warehouse fulfils restock (sends chosen qty)'
$whAfterR   = ((Call Get "/inventory?location=WAREHOUSE" $warehouse $null) | Where-Object productId -eq $p1.id).quantity
$shopAfterR = ((Call Get "/inventory?location=SHOP" $shop $null)            | Where-Object productId -eq $p1.id).quantity
Assert ($whAfterR -eq $whBeforeR - 2) 'restock fulfil decremented WAREHOUSE by sent qty'
Assert ($shopAfterR -eq $shopBeforeR + 2) 'restock fulfil incremented SHOP by sent qty'
CallExpect Patch "/restock-requests/$rid" $warehouse @{ action='DECLINE' } 409 'cannot re-resolve a fulfilled restock (409)'
# Decline path + shopkeeper withdraws their own open ask
$restock3 = Call Post '/restock-requests' $shop @{ items=@(@{ productId=$p2.id; quantity=2 }) }
$dec = Call Patch "/restock-requests/$($restock3[0].id)" $warehouse @{ action='DECLINE' }
Assert ($dec.status -eq 'DECLINED') 'warehouse declines a restock ask'
$restock4 = Call Post '/restock-requests' $shop @{ items=@(@{ productId=$p2.id; quantity=2 }) }
$cancelledRestock = Call Post "/restock-requests/$($restock4[0].id)/cancel" $shop $null
Assert ($cancelledRestock.status -eq 'CANCELLED') 'shopkeeper withdraws own open restock ask'

# --- UC11: order-status report (no revenue) — shopkeeper/owner only ---
CallExpect Get '/reports/order-status?year=2026&month=6' $warehouse $null 403 'warehouse manager blocked from order-status report (403)'
CallExpect Get '/reports/order-status?year=2026&month=6' $customer $null 403 'customer blocked from order-status report (403)'
$ostatus = Call Get '/reports/order-status?year=2026&month=6' $shop $null
Assert ($ostatus.total -ge 1 -and $null -ne $ostatus.statusCounts) 'shopkeeper sees order-status report'
Assert ($ostatus.statusCounts.DELIVERED -ge 1) 'order-status report counts the delivered order'
$cancelledRow = $ostatus.orders | Where-Object status -eq 'CANCELLED' | Select-Object -First 1
Assert ($cancelledRow.cancelledBy -eq 'CUSTOMER') 'cancelled order records who cancelled it (customer)'

# --- UC12: detailed persisted reports + owner archive + RBAC ---
# Staff preview (no persist) is role-shaped; customers are locked out.
CallExpect Get '/reports/preview' $customer $null 403 'customer blocked from report preview (403)'
$shopPreview = Call Get '/reports/preview' $shop $null
Assert ($shopPreview.kind -eq 'SHOPKEEPER' -and $null -ne $shopPreview.data.statusCounts) 'shopkeeper preview is a SHOPKEEPER report'
$whPreview = Call Get '/reports/preview' $warehouse $null
Assert ($whPreview.kind -eq 'WAREHOUSE' -and $null -ne $whPreview.data.summary) 'warehouse preview is a WAREHOUSE report'

# A second shopkeeper send tiles the period — its start is after the first report's end (gap-free, no overlap).
$send2 = Call Post '/reports/send-owner' $shop $null
Assert ([datetime]$send2.periodStart -gt [datetime]$send.periodEnd) 'second report starts after the first ends (no overlap)'
# Warehouse sends its own kind.
$whSend = Call Post '/reports/send-owner' $warehouse $null
Assert ($whSend.kind -eq 'WAREHOUSE' -and $null -ne $whSend.data.summary) 'warehouse send-owner persists a WAREHOUSE report'

# Owner archive: list shows sender + period + sent date; detail returns the full snapshot.
CallExpect Get '/reports/sent' $shop $null 403 'shopkeeper blocked from owner archive (403)'
CallExpect Get '/reports/sent' $customer $null 403 'customer blocked from owner archive (403)'
$archive = Call Get '/reports/sent' $owner $null
Assert (@($archive).Count -ge 3) 'owner archive lists every sent report'
Assert ($null -ne ($archive[0].senderName) -and $null -ne ($archive[0].periodStart)) 'archive rows carry sender + period'
$detail = Call Get "/reports/sent/$($archive[0].id)" $owner $null
Assert ($null -ne $detail.data) 'owner opens full report detail with data'

# A sender sees only their own history.
$mine = Call Get '/reports/mine' $warehouse $null
Assert (@($mine | Where-Object kind -ne 'WAREHOUSE').Count -eq 0) 'reports/mine returns only the senders own reports'

# --- ledger check: every change wrote a movement (spot-check via report/inventory worked above) ---
Write-Host ''
Write-Host "RESULT: $script:pass passed, $script:fail failed"
if ($script:fail -gt 0) { exit 1 }
