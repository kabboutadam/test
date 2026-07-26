/**
 * Bilingual strings for the parent app (English + Arabic). Arabic matters for
 * Lebanon, so the whole parent-facing experience is translated. Operator and
 * driver tools stay English for now (staff-facing).
 *
 * Usage: const { t } = useI18n();  t('home.liveBuses')
 * Interpolation: t('badge.stopsAway', { n: 3 })
 */

export type Lang = 'en' | 'ar';

type Dict = Record<string, string>;

const en: Dict = {
  'app.name': 'BusMapp',
  'tabs.children': 'My Children',
  'tabs.account': 'Account',

  'common.edit': 'Edit',
  'common.save': 'Save changes',
  'common.cancel': 'Cancel',
  'common.remove': 'Remove',
  'common.min': 'min',

  'home.liveBuses': 'Live buses',
  'home.trackingActive': 'Tracking active',
  'home.trackingLocked': 'Tracking locked',
  'home.empty': 'No children yet. Add your first to start tracking.',
  'home.addChild': 'Add child',
  'home.connecting': 'Connecting…',

  'status.enRoute': 'On the move · {speed} km/h',
  'status.atStop': 'Stopped to pick up',
  'status.completed': 'Route completed',
  'status.notStarted': 'Not started',
  'status.connecting': 'Connecting to bus…',

  'badge.stopAway': 'stop away',
  'badge.stopsAway': 'stops away',
  'badge.nStopsAway': '{n} stops away',
  'badge.oneStopAway': '1 stop away',
  'badge.arriving': 'Arriving at your stop',
  'badge.pickedUp': 'Picked up',
  'badge.notStarted': 'Not started yet',

  'track.title': 'Live tracking',
  'track.school': 'School',
  'track.route': 'Route',
  'track.boardsAt': 'Boards at',
  'track.map': 'Map',
  'track.stops': 'Stops',
  'track.lockedTitle': 'Live tracking is locked',
  'track.lockedBody': "Subscribe to see your child's bus in real time.",
  'track.viewPlans': 'View plans',
  'track.childNotFound': 'Child not found.',

  'account.subscription': 'Subscription',
  'account.managePlan': 'Manage plan',
  'account.children': 'Children ({n})',
  'account.notifications': 'Notifications',
  'account.approachAlerts': 'Bus approach alerts',
  'account.approachAlertsSub': 'Get notified at 3 stops, 1 stop, and arriving',
  'account.demoControls': 'Demo controls',
  'account.restartSim': 'Restart bus simulation',
  'account.restartSimSub': 'Send both buses back to their first stop',
  'account.driverMode': 'Driver mode',
  'account.driverModeSub': 'Stream this bus’s location to parents',
  'account.signOut': 'Sign out',
  'account.language': 'Language',

  'paywall.title': 'Track every ride',
  'paywall.currentStatus': 'Current status: {status}',
  'paywall.feature1': 'Live bus location, updated every second',
  'paywall.feature2': 'See exactly how many stops away the bus is',
  'paywall.feature3': 'ETA to your child’s stop',
  'paywall.feature4': 'Covers every child in your family',
  'paywall.subscribe': 'Subscribe {plan}',
  'paywall.monthly': 'monthly',
  'paywall.yearly': 'yearly',
  'paywall.processing': 'Payment could not be completed. Please try again.',

  'addChild.addTitle': 'Add a child',
  'addChild.editTitle': 'Edit child',
  'addChild.school': 'School',
  'addChild.route': 'Route',
  'addChild.pickupStop': 'Pickup stop',
  'addChild.child': 'Child',
  'addChild.fullName': 'Full name',
  'addChild.grade': 'Grade (e.g. Grade 3)',
  'addChild.add': 'Add child',
  'addChild.removeChild': 'Remove child',
  'addChild.removeConfirm': 'Remove {name} from tracking?',
  'addChild.saveError': 'Could not save — is the server reachable?',

  'login.subtitle': 'Sign in with your phone number',
  'login.codeSentTo': 'Enter the code sent to {phone}',
  'login.sendCode': 'Send code',
  'login.verify': 'Verify',
  'login.differentNumber': 'Use a different number',
  'login.invalidCode': 'Invalid or expired code.',
  'login.networkError': 'Network error — is the server running?',
};

const ar: Dict = {
  'app.name': 'باص‌آب',
  'tabs.children': 'أطفالي',
  'tabs.account': 'الحساب',

  'common.edit': 'تعديل',
  'common.save': 'حفظ التغييرات',
  'common.cancel': 'إلغاء',
  'common.remove': 'إزالة',
  'common.min': 'دقيقة',

  'home.liveBuses': 'الباصات المباشرة',
  'home.trackingActive': 'التتبّع مُفعّل',
  'home.trackingLocked': 'التتبّع مقفل',
  'home.empty': 'لا يوجد أطفال بعد. أضف طفلك الأول لبدء التتبّع.',
  'home.addChild': 'إضافة طفل',
  'home.connecting': 'جارٍ الاتصال…',

  'status.enRoute': 'في الطريق · {speed} كم/س',
  'status.atStop': 'متوقّف لأخذ الركّاب',
  'status.completed': 'انتهت الرحلة',
  'status.notStarted': 'لم تبدأ',
  'status.connecting': 'جارٍ الاتصال بالباص…',

  'badge.stopAway': 'محطة',
  'badge.stopsAway': 'محطات',
  'badge.nStopsAway': 'على بُعد {n} محطات',
  'badge.oneStopAway': 'على بُعد محطة واحدة',
  'badge.arriving': 'يصل إلى محطتك',
  'badge.pickedUp': 'تمّ الصعود',
  'badge.notStarted': 'لم تبدأ الرحلة بعد',

  'track.title': 'التتبّع المباشر',
  'track.school': 'المدرسة',
  'track.route': 'المسار',
  'track.boardsAt': 'يصعد من',
  'track.map': 'الخريطة',
  'track.stops': 'المحطات',
  'track.lockedTitle': 'التتبّع المباشر مقفل',
  'track.lockedBody': 'اشترك لمشاهدة باص طفلك مباشرةً.',
  'track.viewPlans': 'عرض الخطط',
  'track.childNotFound': 'لم يتم العثور على الطفل.',

  'account.subscription': 'الاشتراك',
  'account.managePlan': 'إدارة الخطة',
  'account.children': 'الأطفال ({n})',
  'account.notifications': 'الإشعارات',
  'account.approachAlerts': 'تنبيهات اقتراب الباص',
  'account.approachAlertsSub': 'يصلك تنبيه عند 3 محطات، محطة واحدة، وعند الوصول',
  'account.demoControls': 'أدوات العرض التجريبي',
  'account.restartSim': 'إعادة تشغيل المحاكاة',
  'account.restartSimSub': 'إرجاع الباصين إلى محطتهما الأولى',
  'account.driverMode': 'وضع السائق',
  'account.driverModeSub': 'بثّ موقع هذا الباص إلى الأهل',
  'account.signOut': 'تسجيل الخروج',
  'account.language': 'اللغة',

  'paywall.title': 'تتبّع كل رحلة',
  'paywall.currentStatus': 'الحالة الحالية: {status}',
  'paywall.feature1': 'موقع الباص مباشرةً، محدّث كل ثانية',
  'paywall.feature2': 'اعرف بالضبط كم محطة يبعد الباص',
  'paywall.feature3': 'الوقت المتوقّع للوصول إلى محطة طفلك',
  'paywall.feature4': 'يشمل جميع أطفال عائلتك',
  'paywall.subscribe': 'اشترك {plan}',
  'paywall.monthly': 'شهريًا',
  'paywall.yearly': 'سنويًا',
  'paywall.processing': 'تعذّر إتمام الدفع. يُرجى المحاولة مجددًا.',

  'addChild.addTitle': 'إضافة طفل',
  'addChild.editTitle': 'تعديل الطفل',
  'addChild.school': 'المدرسة',
  'addChild.route': 'المسار',
  'addChild.pickupStop': 'محطة الصعود',
  'addChild.child': 'الطفل',
  'addChild.fullName': 'الاسم الكامل',
  'addChild.grade': 'الصف (مثال: الصف الثالث)',
  'addChild.add': 'إضافة طفل',
  'addChild.removeChild': 'إزالة الطفل',
  'addChild.removeConfirm': 'إزالة {name} من التتبّع؟',
  'addChild.saveError': 'تعذّر الحفظ — هل الخادم متاح؟',

  'login.subtitle': 'سجّل الدخول برقم هاتفك',
  'login.codeSentTo': 'أدخل الرمز المُرسل إلى {phone}',
  'login.sendCode': 'إرسال الرمز',
  'login.verify': 'تأكيد',
  'login.differentNumber': 'استخدام رقم آخر',
  'login.invalidCode': 'رمز غير صحيح أو منتهي.',
  'login.networkError': 'خطأ في الشبكة — هل الخادم يعمل؟',
};

export const dictionaries: Record<Lang, Dict> = { en, ar };

/**
 * Maps an arrival (phase + stopsAway) to a translation key + vars, so the pure
 * stopsAway service can stay language-agnostic and the UI localizes at render.
 */
export function arrivalLabelKey(arrival: {
  phase: string;
  stopsAway: number;
}): { key: string; vars?: Record<string, string | number> } {
  switch (arrival.phase) {
    case 'arriving':
      return { key: 'badge.arriving' };
    case 'picked_up':
      return { key: 'badge.pickedUp' };
    case 'not_started':
      return { key: 'badge.notStarted' };
    case 'approaching':
      return { key: 'badge.oneStopAway' };
    default:
      return { key: 'badge.nStopsAway', vars: { n: arrival.stopsAway } };
  }
}

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const template = dictionaries[lang][key] ?? dictionaries.en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}
