const PH_COPY={
  en:{pharmacist:'Pharmacist',pharmacy_portal:'Pharmacist Portal',pharmacy_inventory:'Inventory & Logistics',pharmacy_shop:'Pharmacy',pharmacy_name:'Pharmacy business name',pharmacy_address:'Street address',pharmacy_location:'City, region and country / location',pharmacy_license:'Pharmacist license number',pharmacy_business:'Business registration number',pharmacy_minsante:'MINSANTE authorization reference',pharmacy_note:'Provide the physical address and precise business location, pharmacist license, business registration and MINSANTE authorization. An administrator must verify the original credentials before the pharmacy can operate.',pharmacy_review:'I verified the original license, business registration, MINSANTE authorization and business location.',pharmacy_required:'Complete all pharmacy address, location and credential fields.',pharmacy_review_required:'Confirm credential review before approving.',pharmacy_backend:'A connected backend is required for persistent pharmacy inventory and purchase requests.',pharmacy_safety:'Purchase requests are not a prescription or payment confirmation. Prescription medicines require the pharmacist to review the original prescription before fulfillment. No automated dispensing or live payment is enabled.',pharmacy_items:'Medication inventory',pharmacy_orders:'Purchase requests',pharmacy_add:'Add medication batch',pharmacy_empty:'No available medication batches.',pharmacy_no_orders:'No purchase requests yet.',pharmacy_strength:'Strength / dosage form',pharmacy_unit:'Sale unit / pack size',pharmacy_batch:'Batch number',pharmacy_expiry:'Expiry date',pharmacy_stock:'Available stock',pharmacy_price:'Unit price',pharmacy_rx:'Prescription required',pharmacy_quantity:'Quantity',pharmacy_method:'Fulfillment',pharmacy_pickup:'Pickup',pharmacy_delivery:'Delivery',pharmacy_request:'Request purchase',pharmacy_requested:'Purchase request saved; awaiting pharmacist review.',pharmacy_rx_review:'I verified the original prescription and suitability for this patient.',pharmacy_ready:'Ready',pharmacy_dispatched:'Dispatched',pharmacy_completed:'Completed',pharmacy_cancelled:'Cancelled',pharmacy_update:'Update fulfillment',pharmacy_adjust:'Adjust stock',pharmacy_admin:'Pharmacist profiles',pharmacy_saved:'Saved',pharmacy_unavailable:'Pharmacy service unavailable. Reconnect and retry.'},
  fr:{pharmacist:'Pharmacien',pharmacy_portal:'Portail Pharmacien',pharmacy_inventory:'Stock et Logistique',pharmacy_shop:'Pharmacie',pharmacy_name:'Nom commercial de la pharmacie',pharmacy_address:'Adresse physique',pharmacy_location:'Ville, région et pays / localisation',pharmacy_license:'Numéro de licence du pharmacien',pharmacy_business:'Numéro d’immatriculation de l’entreprise',pharmacy_minsante:'Référence de l’autorisation MINSANTE',pharmacy_note:'Indiquez l’adresse physique et la localisation précise, la licence du pharmacien, l’immatriculation commerciale et l’autorisation MINSANTE. Un administrateur doit vérifier les originaux avant toute opération.',pharmacy_review:'J’ai vérifié les originaux de la licence, de l’immatriculation, de l’autorisation MINSANTE et la localisation.',pharmacy_required:'Complétez l’adresse, la localisation et toutes les références réglementaires.',pharmacy_review_required:'Confirmez la vérification avant validation.',pharmacy_backend:'Un serveur connecté est requis pour le stock et les demandes d’achat persistantes.',pharmacy_safety:'Une demande d’achat n’est ni une ordonnance ni une confirmation de paiement. Le pharmacien doit vérifier l’ordonnance originale avant toute délivrance réglementée. Aucun paiement réel ou délivrance automatique.',pharmacy_items:'Stock de médicaments',pharmacy_orders:'Demandes d’achat',pharmacy_add:'Ajouter un lot',pharmacy_empty:'Aucun lot disponible.',pharmacy_no_orders:'Aucune demande d’achat.',pharmacy_strength:'Dosage / forme',pharmacy_unit:'Unité / taille de boîte',pharmacy_batch:'Numéro de lot',pharmacy_expiry:'Date de péremption',pharmacy_stock:'Stock disponible',pharmacy_price:'Prix unitaire',pharmacy_rx:'Ordonnance obligatoire',pharmacy_quantity:'Quantité',pharmacy_method:'Mode de remise',pharmacy_pickup:'Retrait',pharmacy_delivery:'Livraison',pharmacy_request:'Demander un achat',pharmacy_requested:'Demande enregistrée ; en attente de vérification.',pharmacy_rx_review:'J’ai vérifié l’ordonnance originale et l’adéquation pour ce patient.',pharmacy_ready:'Prêt',pharmacy_dispatched:'Expédié',pharmacy_completed:'Terminé',pharmacy_cancelled:'Annulé',pharmacy_update:'Mettre à jour la remise',pharmacy_adjust:'Ajuster le stock',pharmacy_admin:'Profils pharmaciens',pharmacy_saved:'Enregistré',pharmacy_unavailable:'Service indisponible. Reconnectez-vous et réessayez.'}
};
Object.assign(T.en,PH_COPY.en);Object.assign(T.fr,PH_COPY.fr);
Object.assign(T.en,{pharmacy_medication:'Medication name',pharmacy_total:'Purchase total'});
Object.assign(T.fr,{pharmacy_medication:'Nom du médicament',pharmacy_total:'Total de la demande'});
const PH_FIELDS=[['pharmacyName','pharmacy_name'],['pharmacyAddress','pharmacy_address'],['pharmacyLocation','pharmacy_location'],['pharmacyLicense','pharmacy_license'],['businessRegistration','pharmacy_business'],['minsanteAuthorization','pharmacy_minsante']];
let PH_DATA={items:[],orders:[]},PH_BUSY=false,PH_VIEW=0;

function phEscape(value) {
  return String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
}

function pharmacyRegistrationFields() {
  const container=$('phf');
  const values=Object.fromEntries(PH_FIELDS.map(([name])=>[name,$('ph-'+name)?.value||'']));
  container.innerHTML=`<div class="alt ai">${t('pharmacy_note')}</div>${PH_FIELDS.map(([name,label])=>`<div class="fg"><label class="fl" for="ph-${name}">${t(label)}</label><input class="fc" id="ph-${name}" maxlength="200" required value="${phEscape(values[name])}"></div>`).join('')}`;
  $('rb-ph').textContent=t('pharmacist');
}

async function registerPharmacist() {
  if (PH_BUSY) return;
  if (!$('rtc').checked) return amsg(t('terms_required'));
  const payload={name:$('rn').value.trim(),email:$('re').value.trim(),password:$('rpa').value,phone:$('rph').value,role:'pharmacist'};
  for (const [name] of PH_FIELDS) {payload[name]=$('ph-'+name).value.trim();if(!payload[name])return amsg(t('pharmacy_required'));}
  if (Object.values(payload).some(value=>typeof value==='string'&&/[<>&"\u0000-\u001f]/.test(value)&&value!==payload.password)) return amsg(t('pharmacy_required'));
  PH_BUSY=true;
  try {
    if (ApiState.enabled) await apiRequest('/api/auth/register','POST',payload);
    else {
      if (DB.users.some(user=>user.email.toLowerCase()===payload.email.toLowerCase())) return amsg(t('email_exists'));
      DB.users.push({...payload,id:'pha'+Date.now(),status:'pending_approval',createdAt:todayD(),hfaId:nextHfaId('pharmacist')});
    }
    $('rpa').value='';swtTab('login');$('le').value=payload.email;amsg(t('pending_review_msg'),'o');
  } catch(error) {amsg(error.message);}
  finally {PH_BUSY=false;}
}

function pharmacyCredentialSummary(user) {
  return PH_FIELDS.map(([name,label])=>`<div class="sm"><strong>${t(label)}:</strong> ${phEscape(user[name]||'')}</div>`).join('');
}

function showPharmacyApproval(user) {
  if (CU?.role!=='admin') return;
  openMo(`<div class="mh"><h3 class="mt2">${t('pharmacy_admin')}</h3></div>${pharmacyCredentialSummary(user)}<div class="fg mt18"><label><input type="checkbox" id="ph-credential-review"> ${t('pharmacy_review')}</label></div><div id="ph-review-status" class="mu sm" role="status"></div><div class="mf"><button class="btn bs" onclick="closeMo()">${t('cancel')}</button><button class="btn bp" onclick="approvePharmacist('${user.id}')">${t('approve')}</button></div>`);
}

function approvePharmacist(id) {
  if (CU?.role!=='admin') return;
  if (!$('ph-credential-review')?.checked) {const status=$('ph-review-status');if(status)status.textContent=t('pharmacy_review_required');return;}
  const user=G(id);
  if (!user||PH_FIELDS.some(([name])=>!user[name])) return;
  if (ApiState.enabled) {backendAdminUpdate(id,{status:'active',pharmacyCredentialReview:true});return;}
  user.status='active';user.pharmacyValidatedBy=CU.id;user.pharmacyValidatedAt=tsNow();log('APPROVE_PHARMACIST','User Management');closeMo();navigate(CP);
}

async function renderPharmacy(container) {
  const view=++PH_VIEW,actor=CU?.id;
  if (!CU||!['patient','pharmacist','admin'].includes(CU.role)) return;
  $('tbt').textContent=t(CU.role==='pharmacist'?'pharmacy_portal':'pharmacy_shop');
  container.innerHTML=`<div class="page"><div class="ph"><h2>${t('pharmacy_shop')}</h2></div><p role="status">${t('pharmacy_backend')}</p></div>`;
  if (!ApiState.enabled) return;
  try {
    const data=await apiRequest('/api/pharmacy');
    if (view!==PH_VIEW||CU?.id!==actor||!['pharmacy','dashboard'].includes(CP)) return;
    PH_DATA=data;
    const pharmacist=CU.role==='pharmacist',admin=CU.role==='admin';
    container.innerHTML=`<div class="page pharmacy-page"><div class="ph"><h2>${t(pharmacist?'pharmacy_portal':'pharmacy_shop')}</h2>${pharmacist?`<p>${phEscape(CU.pharmacyName)} · ${phEscape(CU.pharmacyLocation)}</p>`:''}</div>
      <div class="safety-banner"><div>${IC.warn}</div><p>${t('pharmacy_safety')}</p></div>
      ${admin?`<section class="mb18"><h3 class="ct mb8">${t('pharmacy_admin')}</h3>${DB.users.filter(user=>user.role==='pharmacist').map(user=>`<div class="pharmacy-row"><div><strong>${phEscape(user.name)}</strong> ${userStatusBadge(user)}${pharmacyCredentialSummary(user)}</div><div>${user.status==='active'?`<button class="btn bs bsm" onclick="backendAdminUpdate('${user.id}',{status:'suspended'})">${t('suspend')}</button>`:`<button class="btn bp bsm" onclick="showPharmacyApproval(G('${user.id}'))">${t('approve')}</button>`}</div></div>`).join('')}</section>`:''}
      <section class="mb18"><div class="ch"><h3 class="ct">${t('pharmacy_items')}</h3>${pharmacist?`<button class="btn bp bsm" onclick="showPharmacyItem()">${IC.plus} ${t('pharmacy_add')}</button>`:''}</div>
      ${data.items.length?`<div class="tw"><table><thead><tr><th>${t('pharmacy_shop')}</th><th>${t('pharmacy_strength')}</th><th>${t('pharmacy_batch')}</th><th>${t('pharmacy_stock')}</th><th>${t('pharmacy_price')}</th><th>${t('actions')}</th></tr></thead><tbody>${data.items.map(item=>`<tr><td><strong>${phEscape(item.name)}</strong><div class="mu sm">${phEscape(item.pharmacyName)} · ${phEscape(item.pharmacyLocation)}</div><div class="mu sm">${phEscape(item.pharmacyAddress)}</div></td><td>${phEscape(item.strength)} · ${phEscape(item.unit)}${item.requiresPrescription?`<div class="badge bwa">${t('pharmacy_rx')}</div>`:''}</td><td>${phEscape(item.batch)}<div class="mu sm">${t('pharmacy_expiry')}: ${item.expiresOn}</div></td><td>${item.stock}</td><td>${money(item.price,item.currency)}</td><td>${pharmacist?`<button class="btn bs bsm" onclick="showPharmacyStock('${item.id}')">${t('pharmacy_adjust')}</button>`:CU.role==='patient'?`<button class="btn bp bsm" onclick="showPharmacyPurchase('${item.id}')">${t('pharmacy_request')}</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:`<p class="mu sm">${t('pharmacy_empty')}</p>`}</section>
      <section><h3 class="ct mb8">${t('pharmacy_orders')}</h3>${data.orders.length?data.orders.map(order=>`<div class="pharmacy-row"><div><strong>${phEscape(order.name)}</strong><div>${order.quantity} · ${money(order.total,order.currency)} · ${t('pharmacy_'+order.method)}</div><div class="mu sm">${phEscape(order.address)}</div><span class="badge bin">${phEscape(order.status)}</span><div class="mu sm">${order.createdAt.slice(0,10)} · ${phEscape(order.id)}</div></div>${pharmacist&&!['completed','cancelled'].includes(order.status)?`<button class="btn bs bsm" onclick="showPharmacyFulfillment('${order.id}')">${t('pharmacy_update')}</button>`:''}</div>`).join(''):`<p class="mu sm">${t('pharmacy_no_orders')}</p>`}</section></div>`;
  } catch(error) {if(CU?.id===actor&&view===PH_VIEW)container.innerHTML=`<div class="page"><p role="status">${phEscape(error.message||t('pharmacy_unavailable'))}</p></div>`;}
}

function phForm(title,body,handler) {
  openMo(`<div class="mh"><h3 class="mt2">${title}</h3></div><form id="ph-form">${body}<p id="ph-status" class="mu sm" role="status"></p><div class="mf"><button type="button" class="btn bs" onclick="closeMo()">${t('cancel')}</button><button type="submit" class="btn bp">${t('save_changes')}</button></div></form>`);
  $('ph-form').addEventListener('submit',async event=>{
    event.preventDefault();if(PH_BUSY)return;PH_BUSY=true;
    const button=event.target.querySelector('button[type="submit"]');button.disabled=true;
    try {await handler();closeMo();navigate('pharmacy');}
    catch(error) {if($('ph-status'))$('ph-status').textContent=error.message;}
    finally {PH_BUSY=false;button.disabled=false;}
  });
}

function phInput(id,label,type='text',attrs='') {
  return `<div class="fg"><label class="fl" for="${id}">${label}</label><input class="fc" id="${id}" type="${type}" required ${attrs}></div>`;
}

function showPharmacyItem() {
  if (CU?.role!=='pharmacist') return;
  const xaf=priceCurrency()==='XAF';
  phForm(t('pharmacy_add'),phInput('pi-name',t('pharmacy_medication'),'text','maxlength="200"')+phInput('pi-strength',t('pharmacy_strength'),'text','maxlength="200"')+phInput('pi-unit',t('pharmacy_unit'),'text','maxlength="200"')+phInput('pi-batch',t('pharmacy_batch'),'text','maxlength="200"')+phInput('pi-expiry',t('pharmacy_expiry'),'date')+phInput('pi-stock',t('pharmacy_stock'),'number','min="0" max="100000" step="1"')+phInput('pi-price',`${t('pharmacy_price')} (${priceCurrency()})`,'number',xaf?'min="6" max="6000000" step="6"':'min="0.01" max="10000" step="0.01"')+`<label><input id="pi-rx" type="checkbox" checked> ${t('pharmacy_rx')}</label>`,()=>apiRequest('/api/pharmacy/items','POST',{name:$('pi-name').value,strength:$('pi-strength').value,unit:$('pi-unit').value,batch:$('pi-batch').value,expiresOn:$('pi-expiry').value,stock:Number($('pi-stock').value),price:Math.round(Number($('pi-price').value)/(xaf?600:1)*100)/100,requiresPrescription:$('pi-rx').checked}));
}

function showPharmacyStock(id) {
  const item=PH_DATA.items.find(item=>item.id===id);if(!item||CU?.role!=='pharmacist')return;
  phForm(t('pharmacy_adjust'),phInput('pi-stock',t('pharmacy_stock'),'number',`min="0" max="100000" step="1" value="${item.stock}"`),()=>apiRequest('/api/pharmacy/items/'+id,'PATCH',{stock:Number($('pi-stock').value)}));
}

function showPharmacyPurchase(id) {
  const item=PH_DATA.items.find(item=>item.id===id);if(!item||CU?.role!=='patient')return;
  const requestId=crypto.randomUUID();
  phForm(t('pharmacy_request'),`<p>${phEscape(item.name)} · ${money(item.price,item.currency)}</p><p class="mu sm">${t('pharmacy_safety')}</p>`+phInput('po-quantity',t('pharmacy_quantity'),'number',`min="1" max="${Math.min(item.stock,20)}" step="1" value="1"`)+`<p class="bo sm mb18" id="po-total" aria-live="polite"></p><div class="fg"><label class="fl" for="po-method">${t('pharmacy_method')}</label><select class="fc" id="po-method"><option value="pickup">${t('pharmacy_pickup')}</option><option value="delivery">${t('pharmacy_delivery')}</option></select></div>`+phInput('po-address',t('pharmacy_address'),'text',`maxlength="200" value="${phEscape(CU.address||item.pharmacyAddress||'')}"`),()=>apiRequest('/api/pharmacy/orders','POST',{requestId,itemId:id,quantity:Number($('po-quantity').value),method:$('po-method').value,address:$('po-address').value}));
  const updateTotal=()=>{$('po-total').textContent=`${t('pharmacy_total')}: ${money(item.price*Number($('po-quantity').value),item.currency)}`;};
  $('po-quantity').addEventListener('input',updateTotal);updateTotal();
  $('ph-form').querySelector('button[type="submit"]').textContent=t('pharmacy_request');
}

function showPharmacyFulfillment(id) {
  const order=PH_DATA.orders.find(order=>order.id===id);if(!order||CU?.role!=='pharmacist')return;
  const options=order.status==='requested'?['ready','cancelled']:order.status==='ready'?(order.method==='delivery'?['dispatched','cancelled']:['completed','cancelled']):['completed'];
  phForm(t('pharmacy_update'),`<p>${phEscape(order.name)} · ${order.quantity}</p><div class="fg"><label class="fl" for="po-status">${t('status')}</label><select class="fc" id="po-status">${options.map(status=>`<option value="${status}">${t('pharmacy_'+status)}</option>`).join('')}</select></div><label><input id="po-review" type="checkbox" ${order.prescriptionReviewed?'checked':''}> ${t('pharmacy_rx_review')}</label>`,()=>apiRequest('/api/pharmacy/orders/'+id,'PATCH',{status:$('po-status').value,prescriptionReviewed:$('po-review').checked}));
}

NAV.admin[2].items.push({id:'pharmacy',l:()=>t('pharmacy_admin'),i:'clip'});
const labelPharmacyEntry=()=>{
  $('lnd-pharmacist').textContent=t('pharmacy_portal');
  $('lnd-pharmacist-title').textContent=t('pharmacy_portal');
  $('lnd-pharmacist-desc').textContent=LANG==='fr'?'Stock, demandes d’achat et logistique de livraison':'Medication stock, purchase requests and delivery logistics';
  $('lnd-pharmacist-access').textContent=LANG==='fr'?'Accéder au portail':'Access Portal';
};
labelPharmacyEntry();
pharmacyRegistrationFields();
new MutationObserver(()=>{pharmacyRegistrationFields();labelPharmacyEntry();}).observe(document.documentElement,{attributes:true,attributeFilter:['data-lang']});