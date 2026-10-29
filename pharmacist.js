const PH_COPY={
  en:{pharmacist:'Pharmacist',pharmacy_portal:'Pharmacist Portal',pharmacy_inventory:'Inventory & Logistics',pharmacy_shop:'Pharmacy',pharmacy_name:'Pharmacy business name',pharmacy_address:'Street address',pharmacy_location:'City, region and country / location',pharmacy_license:'Pharmacist license number',pharmacy_business:'Business registration number',pharmacy_minsante:'MINSANTE authorization reference',pharmacy_note:'Provide the physical address and precise business location, the pharmacist license, business license, MINSANTE authorization and the owner\'s identity, and upload a copy of each document. An administrator must verify every document before the pharmacy can operate.',pharmacy_review:'I verified the uploaded pharmacist license, business license, MINSANTE authorization, the owner\'s ID card or passport, and the business location.',pharmacy_required:'Complete all pharmacy address, location, owner and credential fields.',pharmacy_review_required:'Confirm credential review before approving.',pharmacy_backend:'A connected backend is required for persistent pharmacy inventory and purchase requests.',pharmacy_safety:'Purchase requests are not a prescription or payment confirmation. Prescription medicines require the pharmacist to review the original prescription before fulfillment. No automated dispensing or live payment is enabled.',pharmacy_items:'Medication inventory',pharmacy_orders:'Purchase requests',pharmacy_add:'Add medication batch',pharmacy_empty:'No available medication batches.',pharmacy_no_orders:'No purchase requests yet.',pharmacy_strength:'Strength / dosage form',pharmacy_unit:'Sale unit / pack size',pharmacy_batch:'Batch number',pharmacy_expiry:'Expiry date',pharmacy_stock:'Available stock',pharmacy_price:'Unit price',pharmacy_rx:'Prescription required',pharmacy_quantity:'Quantity',pharmacy_method:'Fulfillment',pharmacy_pickup:'Pickup',pharmacy_delivery:'Delivery',pharmacy_request:'Request purchase',pharmacy_requested:'Purchase request saved; awaiting pharmacist review.',pharmacy_rx_review:'I verified the original prescription and suitability for this patient.',pharmacy_ready:'Ready',pharmacy_dispatched:'Dispatched',pharmacy_completed:'Completed',pharmacy_cancelled:'Cancelled',pharmacy_update:'Update fulfillment',pharmacy_adjust:'Adjust stock',pharmacy_admin:'Pharmacist profiles',pharmacy_saved:'Saved',pharmacy_unavailable:'Pharmacy service unavailable. Reconnect and retry.'},
  fr:{pharmacist:'Pharmacien',pharmacy_portal:'Portail Pharmacien',pharmacy_inventory:'Stock et Logistique',pharmacy_shop:'Pharmacie',pharmacy_name:'Nom commercial de la pharmacie',pharmacy_address:'Adresse physique',pharmacy_location:'Ville, région et pays / localisation',pharmacy_license:'Numéro de licence du pharmacien',pharmacy_business:'Numéro d’immatriculation de l’entreprise',pharmacy_minsante:'Référence de l’autorisation MINSANTE',pharmacy_note:'Indiquez l’adresse physique et la localisation précise, la licence du pharmacien, la licence commerciale, l’autorisation MINSANTE et l’identité du propriétaire, puis téléversez une copie de chaque document. Un administrateur doit vérifier chaque document avant toute opération.',pharmacy_review:'J’ai vérifié la licence du pharmacien, la licence commerciale, l’autorisation MINSANTE, la CNI ou le passeport du propriétaire et la localisation.',pharmacy_required:'Complétez l’adresse, la localisation, le propriétaire et toutes les références réglementaires.',pharmacy_review_required:'Confirmez la vérification avant validation.',pharmacy_backend:'Un serveur connecté est requis pour le stock et les demandes d’achat persistantes.',pharmacy_safety:'Une demande d’achat n’est ni une ordonnance ni une confirmation de paiement. Le pharmacien doit vérifier l’ordonnance originale avant toute délivrance réglementée. Aucun paiement réel ou délivrance automatique.',pharmacy_items:'Stock de médicaments',pharmacy_orders:'Demandes d’achat',pharmacy_add:'Ajouter un lot',pharmacy_empty:'Aucun lot disponible.',pharmacy_no_orders:'Aucune demande d’achat.',pharmacy_strength:'Dosage / forme',pharmacy_unit:'Unité / taille de boîte',pharmacy_batch:'Numéro de lot',pharmacy_expiry:'Date de péremption',pharmacy_stock:'Stock disponible',pharmacy_price:'Prix unitaire',pharmacy_rx:'Ordonnance obligatoire',pharmacy_quantity:'Quantité',pharmacy_method:'Mode de remise',pharmacy_pickup:'Retrait',pharmacy_delivery:'Livraison',pharmacy_request:'Demander un achat',pharmacy_requested:'Demande enregistrée ; en attente de vérification.',pharmacy_rx_review:'J’ai vérifié l’ordonnance originale et l’adéquation pour ce patient.',pharmacy_ready:'Prêt',pharmacy_dispatched:'Expédié',pharmacy_completed:'Terminé',pharmacy_cancelled:'Annulé',pharmacy_update:'Mettre à jour la remise',pharmacy_adjust:'Ajuster le stock',pharmacy_admin:'Profils pharmaciens',pharmacy_saved:'Enregistré',pharmacy_unavailable:'Service indisponible. Reconnectez-vous et réessayez.'}
};
Object.assign(T.en,PH_COPY.en);Object.assign(T.fr,PH_COPY.fr);
Object.assign(T.en,{pharmacy_medication:'Medication name',pharmacy_total:'Purchase total'});
Object.assign(T.fr,{pharmacy_medication:'Nom du médicament',pharmacy_total:'Total de la demande'});
Object.assign(T.en,{pharmacy_patient_qr:'My pharmacy QR',pharmacy_patient_qr_intro:'Show this one-use QR code to a validated pharmacy at checkout. It expires in five minutes and records the sale in your pharmacy history.',pharmacy_show_qr:'Show a checkout QR code',pharmacy_qr_expiry:'Expires at',pharmacy_qr_loading:'Creating secure QR code…',pharmacy_qr_error:'Could not create a checkout QR code. Reconnect and try again.',pharmacy_pos:'Record point-of-sale sale',pharmacy_pos_scan:'Start camera QR scan',pharmacy_pos_scan_start:'Point the camera at the patient’s HFA pharmacy QR code.',pharmacy_pos_scan_unsupported:'Camera scanning is unavailable here. Connect a QR scanner or paste the scanned code.',pharmacy_pos_scan_error:'Could not start camera scanning. Check camera permission or enter a scanned code.',pharmacy_pos_patient_code:'Patient QR code',pharmacy_pos_pick_items:'Select products and quantities',pharmacy_pos_review_rx:'I checked the original prescription for each prescription-required item.',pharmacy_pos_not_payment:'This records the sale only. It does not process or confirm payment; use your approved pharmacy payment method.',pharmacy_pos_save:'Record sale',pharmacy_pos_saved:'Sale recorded in the patient and pharmacy profiles. Payment was not processed or confirmed.',pharmacy_pos_online:'Point-of-sale recording requires a live connection to the HFA server. No sale has been recorded.',pharmacy_pos_complete:'Scan the patient QR code and select at least one valid product quantity.',pharmacy_pos_history:'Point-of-sale history',pharmacy_no_sales:'No point-of-sale sales yet.',pharmacy_sale_recorded:'Recorded',pharmacy_sale_patient:'Patient',pharmacy_sale_pharmacy:'Pharmacy',pharmacy_sale_items:'Products'});
Object.assign(T.fr,{pharmacy_patient_qr:'Mon QR pharmacie',pharmacy_patient_qr_intro:'Présentez ce QR code à usage unique à une pharmacie validée lors du paiement. Il expire dans cinq minutes et enregistre la vente dans votre historique pharmacie.',pharmacy_show_qr:'Afficher un QR code de paiement',pharmacy_qr_expiry:'Expire à',pharmacy_qr_loading:'Création du QR code sécurisé…',pharmacy_qr_error:'Impossible de créer le QR code. Reconnectez-vous et réessayez.',pharmacy_pos:'Enregistrer une vente au comptoir',pharmacy_pos_scan:'Démarrer le scan caméra',pharmacy_pos_scan_start:'Pointez la caméra vers le QR pharmacie HFA du patient.',pharmacy_pos_scan_unsupported:'Le scan caméra n’est pas disponible. Connectez un lecteur QR ou collez le code scanné.',pharmacy_pos_scan_error:'Impossible de démarrer le scan. Vérifiez l’autorisation caméra ou saisissez le code scanné.',pharmacy_pos_patient_code:'QR code du patient',pharmacy_pos_pick_items:'Choisir les produits et les quantités',pharmacy_pos_review_rx:'J’ai vérifié l’ordonnance originale pour chaque produit soumis à ordonnance.',pharmacy_pos_not_payment:'Cela enregistre uniquement la vente. Le paiement n’est ni traité ni confirmé ; utilisez le mode de paiement approuvé de la pharmacie.',pharmacy_pos_save:'Enregistrer la vente',pharmacy_pos_saved:'Vente enregistrée dans les profils du patient et de la pharmacie. Le paiement n’a pas été traité ni confirmé.',pharmacy_pos_online:'Une connexion au serveur HFA est requise pour enregistrer une vente. Aucune vente n’a été enregistrée.',pharmacy_pos_complete:'Scannez le QR du patient et sélectionnez au moins une quantité valide.',pharmacy_pos_history:'Historique des ventes au comptoir',pharmacy_no_sales:'Aucune vente au comptoir pour le moment.',pharmacy_sale_recorded:'Enregistrée',pharmacy_sale_patient:'Patient',pharmacy_sale_pharmacy:'Pharmacie',pharmacy_sale_items:'Produits'});
Object.assign(T.en,{pharmacy_owner_name:'Owner full name',pharmacy_owner_id_type:'Owner identity document type',pharmacy_owner_id_number:'Owner national ID or passport number',pharmacy_docs_title:'Registration documents (PDF, PNG, JPEG or WebP, max 2 MB each)',pharmacy_docs_short:'Documents uploaded',pharmacy_doc_license:'Pharmacist license certificate',pharmacy_doc_business:'Business license / registration certificate',pharmacy_doc_minsante:'MINSANTE authorization (Ministry of Public Health)',pharmacy_doc_owner_id:'Owner national ID card or passport',pharmacy_docs_required:'Upload every required document as a PDF, PNG, JPEG or WebP file of 2 MB or less.',pharmacy_docs_missing:'Credentials or registration documents are missing; this pharmacy cannot be approved.',pharmacy_doc_missing:'Missing',pharmacy_view_doc:'View'});
Object.assign(T.fr,{pharmacy_owner_name:'Nom complet du propriétaire',pharmacy_owner_id_type:'Type de pièce d’identité du propriétaire',pharmacy_owner_id_number:'Numéro de CNI ou de passeport du propriétaire',pharmacy_docs_title:'Documents d’enregistrement (PDF, PNG, JPEG ou WebP, 2 Mo max. chacun)',pharmacy_docs_short:'Documents téléversés',pharmacy_doc_license:'Certificat de licence du pharmacien',pharmacy_doc_business:'Licence commerciale / certificat d’immatriculation',pharmacy_doc_minsante:'Autorisation MINSANTE (Ministère de la Santé Publique)',pharmacy_doc_owner_id:'CNI ou passeport du propriétaire',pharmacy_docs_required:'Téléversez chaque document requis en PDF, PNG, JPEG ou WebP de 2 Mo maximum.',pharmacy_docs_missing:'Des références ou documents manquent ; cette pharmacie ne peut pas être validée.',pharmacy_doc_missing:'Manquant',pharmacy_view_doc:'Voir'});
const PH_FIELDS=[['pharmacyName','pharmacy_name'],['pharmacyAddress','pharmacy_address'],['pharmacyLocation','pharmacy_location'],['pharmacyLicense','pharmacy_license'],['businessRegistration','pharmacy_business'],['minsanteAuthorization','pharmacy_minsante'],['ownerName','pharmacy_owner_name'],['ownerIdType','pharmacy_owner_id_type'],['ownerIdNumber','pharmacy_owner_id_number']];
// Every document must be uploaded at registration; the admin cannot approve a pharmacy with any missing.
const PH_DOCS=[['pharmacistLicense','pharmacy_doc_license'],['businessLicense','pharmacy_doc_business'],['minsanteAuthorization','pharmacy_doc_minsante'],['ownerIdentity','pharmacy_doc_owner_id']];
const PH_DOC_TYPES=['application/pdf','image/png','image/jpeg','image/webp'],PH_DOC_MAX=2*1024*1024;
let PH_DATA={items:[],orders:[],sales:[]},PH_BUSY=false,PH_VIEW=0,PH_SCAN_STREAM=null,PH_SCAN_FRAME=0,PH_SCAN_OBSERVER=null;

// Browser-only store used when no HFA server is reachable; it starts empty (no built-in stock or orders).
const PH_LOCAL={items:[],orders:[],sales:[]};

function phLocalRequest(path,method='GET',body={}) {
  const user=CU,today=new Date().toISOString().slice(0,10),fail=message=>{throw new Error(message);};
  if(path==='/api/pharmacy/pos'||path==='/api/pharmacy/patient-code') fail(t('pharmacy_pos_online'));
  const owner=item=>DB.users.find(account=>account.id===item.pharmacistId);
  const validated=account=>account?.role==='pharmacist'&&account.status==='active'&&!!account.pharmacyValidatedAt;
  const text=value=>typeof value==='string'&&value.trim().length>0&&value.trim().length<=200&&!/[<>&"\u0000-\u001f]/.test(value);
  if (path==='/api/pharmacy'&&method==='GET') {
    if (!user||!['patient','pharmacist','admin'].includes(user.role)||(user.role==='pharmacist'&&!validated(user))) fail(t('pharmacy_unavailable'));
    const items=PH_LOCAL.items.filter(item=>user.role==='admin'||(user.role==='pharmacist'?item.pharmacistId===user.id:validated(owner(item))&&item.stock>0&&item.expiresOn>today))
      .map(item=>({...item,currency:'USD',pharmacyName:owner(item)?.pharmacyName,pharmacyAddress:owner(item)?.pharmacyAddress,pharmacyLocation:owner(item)?.pharmacyLocation}));
    const orders=PH_LOCAL.orders.filter(order=>user.role==='admin'||order.patientId===user.id||order.pharmacistId===user.id)
      .map(order=>({...order,currency:'USD',name:PH_LOCAL.items.find(item=>item.id===order.itemId)?.name})).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    const sales=PH_LOCAL.sales.filter(sale=>user.role==='admin'||sale.patientId===user.id||sale.pharmacistId===user.id);
    return {items,orders,sales};
  }
  if (path==='/api/pharmacy/orders'&&method==='POST') {
    if (user?.role!=='patient') fail(t('pharmacy_unavailable'));
    if (!Number.isInteger(body.quantity)||body.quantity<1||body.quantity>20||!['pickup','delivery'].includes(body.method)||!text(body.address)) fail(t('pharmacy_required'));
    const prior=PH_LOCAL.orders.find(order=>order.patientId===user.id&&order.requestId===body.requestId);
    if (prior) return {id:prior.id,status:prior.status};
    const item=PH_LOCAL.items.find(entry=>entry.id===body.itemId);
    if (!item||!validated(owner(item))||item.expiresOn<=today) fail('Medication is unavailable');
    if (item.stock<body.quantity) fail('Not enough available stock');
    item.stock-=body.quantity;
    const order={id:crypto.randomUUID(),requestId:body.requestId,itemId:item.id,patientId:user.id,pharmacistId:item.pharmacistId,quantity:body.quantity,total:Math.round(item.price*100)*body.quantity/100,method:body.method,address:body.address.trim(),status:'requested',prescriptionReviewed:false,createdAt:new Date().toISOString()};
    PH_LOCAL.orders.push(order);
    return {id:order.id,status:'requested'};
  }
  if (!validated(user)) fail('An administrator-validated pharmacist is required');
  if (path==='/api/pharmacy/items'&&method==='POST') {
    if (!['name','strength','unit','batch'].every(field=>text(body[field]))) fail(t('pharmacy_required'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.expiresOn||'')||body.expiresOn<=today) fail('A valid future expiry date is required');
    if (!Number.isInteger(body.stock)||body.stock<0||body.stock>100000||!(body.price>=0.01&&body.price<=10000)) fail(t('pharmacy_required'));
    const item={id:crypto.randomUUID(),pharmacistId:user.id,name:body.name.trim(),strength:body.strength.trim(),unit:body.unit.trim(),batch:body.batch.trim(),expiresOn:body.expiresOn,stock:body.stock,price:body.price,requiresPrescription:!!body.requiresPrescription};
    PH_LOCAL.items.push(item);
    return {id:item.id};
  }
  const [,kind,id]=path.match(/^\/api\/pharmacy\/(items|orders)\/([^/]+)$/)||[];
  if (kind==='items'&&method==='PATCH') {
    const item=PH_LOCAL.items.find(entry=>entry.id===id&&entry.pharmacistId===user.id);
    if (!item) fail('Not found');
    if (!Number.isInteger(body.stock)||body.stock<0||body.stock>100000) fail(t('pharmacy_required'));
    item.stock=body.stock;
    return {status:'updated'};
  }
  if (kind==='orders'&&method==='PATCH') {
    const order=PH_LOCAL.orders.find(entry=>entry.id===id&&entry.pharmacistId===user.id);
    if (!order) fail('Not found');
    const transitions={requested:['ready','cancelled'],ready:order.method==='delivery'?['dispatched','cancelled']:['completed','cancelled'],dispatched:['completed']};
    if (!transitions[order.status]?.includes(body.status)) fail('Invalid fulfillment transition');
    const item=PH_LOCAL.items.find(entry=>entry.id===order.itemId),reviewed=order.prescriptionReviewed||body.prescriptionReviewed===true;
    if (body.status!=='cancelled'&&item.expiresOn<=today) fail('Expired stock cannot be fulfilled');
    if (body.status!=='cancelled'&&item.requiresPrescription&&!reviewed) fail('Verify the original prescription before fulfillment');
    order.status=body.status;order.prescriptionReviewed=reviewed;
    if (body.status==='cancelled') item.stock+=order.quantity;
    return {status:body.status};
  }
  fail('Not found');
}

// Offline with a backend: read the saved copy, apply the change to it, and queue the request for the server.
function phOfflineRequest(path,method,body={}) {
  if(path==='/api/pharmacy/pos'||path==='/api/pharmacy/patient-code') throw new Error(t('pharmacy_pos_online'));
  if (method==='GET') return structuredClone(PH_DATA);
  const fail=message=>{throw new Error(message);};
  const [,kind,id]=path.match(/^\/api\/pharmacy\/(items|orders)(?:\/([^/]+))?$/)||[];
  const request={path,method,body:{...body}};
  if (kind==='items'&&method==='POST'&&!id) {
    request.body.id=crypto.randomUUID();
    PH_DATA.items.push({...request.body,pharmacistId:CU.id,currency:'USD',pharmacyName:CU.pharmacyName,pharmacyAddress:CU.pharmacyAddress,pharmacyLocation:CU.pharmacyLocation});
  } else if (kind==='items'&&method==='PATCH') {
    const item=PH_DATA.items.find(entry=>entry.id===id)||fail('Not found');
    item.stock=body.stock;
  } else if (kind==='orders'&&method==='POST'&&!id) {
    const item=PH_DATA.items.find(entry=>entry.id===body.itemId)||fail('Medication is unavailable');
    if (item.stock<body.quantity) fail('Not enough available stock');
    item.stock-=body.quantity;
    PH_DATA.orders.unshift({id:'queued-'+body.requestId,requestId:body.requestId,itemId:item.id,name:item.name,patientId:CU.id,pharmacistId:item.pharmacistId,quantity:body.quantity,total:Math.round(item.price*100)*body.quantity/100,currency:'USD',method:body.method,address:body.address.trim(),status:'requested',prescriptionReviewed:false,createdAt:new Date().toISOString(),queued:true});
  } else if (kind==='orders'&&method==='PATCH') {
    const order=PH_DATA.orders.find(entry=>entry.id===id&&!entry.queued)||fail('Not found');
    order.status=body.status;order.prescriptionReviewed=order.prescriptionReviewed||body.prescriptionReviewed===true;
    const item=PH_DATA.items.find(entry=>entry.id===order.itemId);
    if (body.status==='cancelled'&&item) item.stock+=order.quantity;
  } else fail('Not found');
  return HFAOffline.enqueue(request).then(()=>HFAOffline.save()).then(()=>({status:'queued'}));
}

function phRequest(path,method='GET',body) {
  if((path==='/api/pharmacy/pos'||path==='/api/pharmacy/patient-code')&&(!ApiState.enabled||ApiState.offline)) return Promise.reject(new Error(t('pharmacy_pos_online')));
  if (!ApiState.enabled) return Promise.resolve().then(()=>phLocalRequest(path,method,body));
  return ApiState.offline?Promise.resolve().then(()=>phOfflineRequest(path,method,body)):apiRequest(path,method,body);
}

function phEscape(value) {
  return String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
}

function phField(name,label,value) {
  const control=name==='ownerIdType'
    ?`<select class="fc" id="ph-${name}" required><option value="">${t('id_type_placeholder')}</option>${['national_id','passport'].map(type=>`<option value="${type}"${type===value?' selected':''}>${t('id_type_'+type)}</option>`).join('')}</select>`
    :`<input class="fc" id="ph-${name}" maxlength="200" required value="${phEscape(value)}">`;
  return `<div class="fg"><label class="fl" for="ph-${name}">${t(label)}</label>${control}</div>`;
}

// Region and town give the pharmacy its number (HFA-PH-<region>-<town>-0001).
const PH_REGIONS=[['adamawa','Adamawa','Adamaoua'],['centre','Centre','Centre'],['east','East','Est'],['far_north','Far North','Extrême-Nord'],['littoral','Littoral','Littoral'],['north','North','Nord'],['north_west','North West','Nord-Ouest'],['west','West','Ouest'],['south','South','Sud'],['south_west','South West','Sud-Ouest']];
function phLocationFields(region,town) {
  const fr=LANG==='fr';
  return `<div class="fr"><div class="fg"><label class="fl" for="ph-pharmacyRegion">${fr?'Région de la pharmacie':'Pharmacy region'}</label><select class="fc" id="ph-pharmacyRegion" required><option value="">${fr?'Choisir…':'Select…'}</option>${PH_REGIONS.map(([code,en,frLabel])=>`<option value="${code}"${code===region?' selected':''}>${fr?frLabel:en}</option>`).join('')}</select></div>
    <div class="fg"><label class="fl" for="ph-pharmacyTown">${fr?'Ville de la pharmacie':'Pharmacy town'}</label><input class="fc" id="ph-pharmacyTown" maxlength="120" required value="${phEscape(town)}"></div></div>
    <p class="mu sm" style="margin-top:-6px;margin-bottom:12px">${fr?'Votre numéro de pharmacie HFA est créé à partir de la région et de la ville, par ex. HFA-PH-LT-DLA-0001.':'Your HFA pharmacy number is created from the region and town, e.g. HFA-PH-LT-DLA-0001.'}</p>`;
}

function pharmacyRegistrationFields() {
  const container=$('phf');
  const values=Object.fromEntries(PH_FIELDS.map(([name])=>[name,$('ph-'+name)?.value||'']));
  const chosen=PH_DOCS.map(([kind])=>$('phd-'+kind)).filter(Boolean);
  const region=$('ph-pharmacyRegion')?.value||'',town=$('ph-pharmacyTown')?.value||'';
  container.innerHTML=`<div class="alt ai">${t('pharmacy_note')}</div>${PH_FIELDS.map(([name,label])=>phField(name,label,values[name])).join('')}${phLocationFields(region,town)}<p class="bo sm mt18 mb12">${t('pharmacy_docs_title')}</p>${PH_DOCS.map(([kind,label])=>`<div class="fg"><label class="fl" for="phd-${kind}">${t(label)}</label><input class="fc" type="file" id="phd-${kind}" accept="${PH_DOC_TYPES.join(',')}" required></div>`).join('')}`;
  chosen.forEach(input=>$(input.id).replaceWith(input)); // keep selected files across language re-renders
  $('rb-ph').textContent=t('pharmacist');
}

function phReadFile(file) {
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);});
}

async function registerPharmacist() {
  if (PH_BUSY) return;
  if (!$('rtc').checked) return amsg(t('terms_required'));
  const payload={name:$('rn').value.trim(),email:$('re').value.trim(),password:$('rpa').value,phone:$('rph').value};
  for (const [name] of PH_FIELDS) {payload[name]=$('ph-'+name).value.trim();if(!payload[name])return amsg(t('pharmacy_required'));}
  if (!['national_id','passport'].includes(payload.ownerIdType)) return amsg(t('pharmacy_required'));
  const regionInput=$('ph-pharmacyRegion'),townInput=$('ph-pharmacyTown');
  if (regionInput&&townInput) {
    payload.pharmacyRegion=regionInput.value;payload.pharmacyTown=townInput.value.trim();
    if (!PH_REGIONS.some(([code])=>code===payload.pharmacyRegion)||!payload.pharmacyTown) return amsg(t('pharmacy_required'));
  }
  if (Object.values(payload).some(value=>typeof value==='string'&&/[<>&"\u0000-\u001f]/.test(value)&&value!==payload.password)) return amsg(t('pharmacy_required'));
  const files=PH_DOCS.map(([kind])=>[kind,$('phd-'+kind)?.files?.[0]]);
  if (files.some(([,file])=>!file||!PH_DOC_TYPES.includes(file.type)||!file.size||file.size>PH_DOC_MAX)) return amsg(t('pharmacy_docs_required'));
  PH_BUSY=true;
  try {
    const documents={};
    for (const [kind,file] of files) documents[kind]={fileName:file.name.replace(/[<>\u0000-\u001f/\\]/g,'_').slice(0,180),mime:file.type,size:file.size,data:await phReadFile(file)};
    if (ApiState.enabled) {
      const {queued}=await HFAOffline.submitRegistration('/api/auth/register/pharmacist',{...payload,documents:Object.fromEntries(Object.entries(documents).map(([kind,doc])=>[kind,{fileName:doc.fileName,content:doc.data.slice(doc.data.indexOf(',')+1)}]))});
      if (queued) {$('rpa').value='';PH_DOCS.forEach(([kind])=>{$('phd-'+kind).value='';});swtTab('login');$('le').value=payload.email;amsg(t('offline_registration_queued'),'i');return;}
    } else return amsg(t('accounts_unavailable_body'),'i'); // pharmacies register only with the HFA server
    $('rpa').value='';PH_DOCS.forEach(([kind])=>{$('phd-'+kind).value='';});swtTab('login');$('le').value=payload.email;amsg(t('pending_review_msg'),'o');
  } catch(error) {amsg(error.message);}
  finally {PH_BUSY=false;}
}

const phDocumentsComplete=user=>PH_DOCS.every(([kind])=>user.pharmacyDocuments?.[kind]);

function pharmacyCredentialSummary(user) {
  return PH_FIELDS.map(([name,label])=>`<div class="sm"><strong>${t(label)}:</strong> ${phEscape(name==='ownerIdType'&&user[name]?t('id_type_'+user[name]):user[name]||'')}</div>`).join('')
    +`<div class="sm"><strong>${t('pharmacy_docs_short')}:</strong> ${PH_DOCS.filter(([kind])=>user.pharmacyDocuments?.[kind]).length}/${PH_DOCS.length}</div>`;
}

function pharmacyDocumentList(user) {
  return `<p class="bo sm mt18 mb12">${t('pharmacy_docs_title')}</p>`+PH_DOCS.map(([kind,label])=>{
    const doc=user.pharmacyDocuments?.[kind];
    return `<div class="pharmacy-row"><div class="sm"><strong>${t(label)}</strong><div class="mu">${doc?phEscape(doc.fileName):''}</div></div>${doc?`<button type="button" class="btn bgh bsm" onclick="phOpenDocument('${user.id}','${kind}')">${t('pharmacy_view_doc')}</button>`:`<span class="badge bwa">${t('pharmacy_doc_missing')}</span>`}</div>`;
  }).join('');
}

function phDataBlob(data) {
  const [head,body]=data.split(','),bytes=Uint8Array.from(atob(body),character=>character.charCodeAt(0));
  return new Blob([bytes],{type:head.slice(5,head.indexOf(';'))});
}

async function phOpenDocument(id,kind) {
  const doc=CU?.role==='admin'?G(id)?.pharmacyDocuments?.[kind]:null;
  if (!doc) return;
  const tab=window.open('','_blank'); // opened synchronously so popup blockers allow it
  try {
    let blob;
    if (doc.data) blob=phDataBlob(doc.data);
    else {
      const response=await fetch(`/api/admin/users/${encodeURIComponent(id)}/documents/${kind}`,{credentials:'same-origin',signal:AbortSignal.timeout(30000)});
      if (!response.ok) throw new Error(t('pharmacy_unavailable'));
      blob=await response.blob();
    }
    const url=URL.createObjectURL(blob);
    if (tab) {tab.opener=null;tab.location.href=url;} else window.location.assign(url);
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  } catch(error) {tab?.close();alert(error.message);}
}

function showPharmacyApproval(user) {
  if (CU?.role!=='admin') return;
  openMo(`<div class="mh"><h3 class="mt2">${t('pharmacy_admin')}</h3></div>${pharmacyCredentialSummary(user)}${pharmacyDocumentList(user)}<div class="fg mt18"><label><input type="checkbox" id="ph-credential-review"> ${t('pharmacy_review')}</label></div><div id="ph-review-status" class="mu sm" role="status"></div><div class="mf"><button class="btn bs" onclick="closeMo()">${t('cancel')}</button><button class="btn bp" onclick="approvePharmacist('${user.id}')">${t('approve')}</button></div>`);
}

function approvePharmacist(id) {
  if (CU?.role!=='admin') return;
  if (!$('ph-credential-review')?.checked) {const status=$('ph-review-status');if(status)status.textContent=t('pharmacy_review_required');return;}
  const user=G(id);
  if (!user||PH_FIELDS.some(([name])=>!user[name])||!phDocumentsComplete(user)) {const status=$('ph-review-status');if(status)status.textContent=t('pharmacy_docs_missing');return;}
  if (ApiState.enabled) {backendAdminUpdate(id,{status:'active',pharmacyCredentialReview:true});return;}
  user.status='active';user.pharmacyValidatedBy=CU.id;user.pharmacyValidatedAt=tsNow();log('APPROVE_PHARMACIST','User Management');closeMo();navigate(CP);
}

function renderPharmacySales(sales,pharmacist) {
  if(!sales.length)return `<p class="mu sm">${t('pharmacy_no_sales')}</p>`;
  return sales.map(sale=>`<article class="card mb12">
    <div class="ch"><div class="ct">${phEscape(pharmacist?sale.patientName:sale.pharmacyName)}</div><span class="badge bin">${t('pharmacy_sale_recorded')}</span></div>
    <ul>${sale.items.map(item=>`<li>${phEscape(item.name)} · ${item.quantity} × ${money(item.unitPrice,sale.currency)} · ${money(item.lineTotal,sale.currency)}</li>`).join('')}</ul>
    <p class="bo">${money(sale.total,sale.currency)}</p><p class="mu sm">${sale.createdAt.slice(0,19).replace('T',' ')} · ${phEscape(sale.id)}</p>
  </article>`).join('');
}

async function renderPharmacy(container) {
  const view=++PH_VIEW,actor=CU?.id;
  if (!CU||!['patient','pharmacist','admin'].includes(CU.role)) return;
  $('tbt').textContent=t(CU.role==='pharmacist'?'pharmacy_portal':'pharmacy_shop');
  container.innerHTML=`<div class="page"><div class="ph"><h2>${t('pharmacy_shop')}</h2></div><p role="status">${t('pharmacy_backend')}</p></div>`;
  if (ApiState.loading) await ApiState.ready;
  if (ApiState.failed) return;
  try {
    const data=await phRequest('/api/pharmacy');
    if (view!==PH_VIEW||CU?.id!==actor||!['pharmacy','dashboard'].includes(CP)) return;
    PH_DATA={...data,sales:data.sales||[]};
    const pharmacist=CU.role==='pharmacist',admin=CU.role==='admin';
    container.innerHTML=`<div class="page pharmacy-page"><div class="ph"><h2>${t(pharmacist?'pharmacy_portal':'pharmacy_shop')}</h2>${pharmacist?`<p>${phEscape(CU.pharmacyName)} · ${phEscape(CU.pharmacyLocation)}</p>`:''}</div>
      <div class="safety-banner"><div>${IC.warn}</div><p>${t('pharmacy_safety')}</p></div>
      ${CU.role==='patient'?`<section class="card mb18"><h3 class="ct">${t('pharmacy_patient_qr')}</h3><p class="mu sm">${t('pharmacy_patient_qr_intro')}</p><button class="btn bp bsm mt8" type="button" onclick="showPatientPharmacyCode()">${t('pharmacy_show_qr')}</button><div id="pharmacy-patient-code" class="mt12" aria-live="polite"></div></section>`:''}
      ${admin?`<section class="mb18"><h3 class="ct mb8">${t('pharmacy_admin')}</h3>${DB.users.filter(user=>user.role==='pharmacist').map(user=>`<div class="pharmacy-row"><div><strong>${phEscape(user.name)}</strong> ${userStatusBadge(user)}${pharmacyCredentialSummary(user)}</div><div>${user.status==='active'?`<button class="btn bs bsm" onclick="backendAdminUpdate('${user.id}',{status:'suspended'})">${t('suspend')}</button>`:`<button class="btn bp bsm" onclick="showPharmacyApproval(G('${user.id}'))">${t('approve')}</button>`}</div></div>`).join('')}</section>`:''}
      <section class="mb18"><div class="ch"><h3 class="ct">${t('pharmacy_items')}</h3>${pharmacist?`<div class="pc-actions"><button class="btn bp bsm" onclick="showPharmacyItem()">${IC.plus} ${t('pharmacy_add')}</button><button class="btn bs bsm" onclick="showPharmacyPOS()">${t('pharmacy_pos')}</button></div>`:''}</div>
      ${data.items.length?`<div class="tw"><table><thead><tr><th>${t('pharmacy_shop')}</th><th>${t('pharmacy_strength')}</th><th>${t('pharmacy_batch')}</th><th>${t('pharmacy_stock')}</th><th>${t('pharmacy_price')}</th><th>${t('actions')}</th></tr></thead><tbody>${data.items.map(item=>`<tr><td><strong>${phEscape(item.name)}</strong><div class="mu sm">${phEscape(item.pharmacyName)} · ${phEscape(item.pharmacyLocation)}</div><div class="mu sm">${phEscape(item.pharmacyAddress)}</div></td><td>${phEscape(item.strength)} · ${phEscape(item.unit)}${item.requiresPrescription?`<div class="badge bwa">${t('pharmacy_rx')}</div>`:''}</td><td>${phEscape(item.batch)}<div class="mu sm">${t('pharmacy_expiry')}: ${item.expiresOn}</div></td><td>${item.stock}</td><td>${money(item.price,item.currency)}</td><td>${pharmacist?`<button class="btn bs bsm" onclick="showPharmacyStock('${item.id}')">${t('pharmacy_adjust')}</button>`:CU.role==='patient'?`<button class="btn bp bsm" onclick="showPharmacyPurchase('${item.id}')">${t('pharmacy_request')}</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:`<p class="mu sm">${t('pharmacy_empty')}</p>`}</section>
      <section class="mb18"><h3 class="ct mb8">${t('pharmacy_orders')}</h3>${data.orders.length?data.orders.map(order=>`<div class="pharmacy-row"><div><strong>${phEscape(order.name)}</strong><div>${order.quantity} · ${money(order.total,order.currency)} · ${t('pharmacy_'+order.method)}</div><div class="mu sm">${phEscape(order.address)}</div><span class="badge bin">${phEscape(order.status==='requested'?tv('requested'):t('pharmacy_'+order.status))}</span><div class="mu sm">${order.createdAt.slice(0,10)} · ${phEscape(order.id)}</div></div>${pharmacist&&!['completed','cancelled'].includes(order.status)?`<button class="btn bs bsm" onclick="showPharmacyFulfillment('${order.id}')">${t('pharmacy_update')}</button>`:''}</div>`).join(''):`<p class="mu sm">${t('pharmacy_no_orders')}</p>`}</section>
      <section><h3 class="ct mb8">${t('pharmacy_pos_history')}</h3>${renderPharmacySales(PH_DATA.sales,pharmacist)}</section></div>`;
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

async function showPatientPharmacyCode() {
  const panel=$('pharmacy-patient-code');
  if(CU?.role!=='patient'||!panel)return;
  panel.innerHTML=`<p class="mu sm" role="status">${t('pharmacy_qr_loading')}</p>`;
  try {
    const result=await phRequest('/api/pharmacy/patient-code','POST',{});
    panel.innerHTML=`<img width="240" height="240" src="${phEscape(result.qr)}" alt="${t('pharmacy_patient_qr')}"><p class="mu sm">${t('pharmacy_qr_expiry')}: ${new Date(result.expiresAt).toLocaleTimeString(LANG==='fr'?'fr-FR':'en-GB',{hour:'2-digit',minute:'2-digit'})}</p>`;
  } catch(error) {
    panel.innerHTML=`<p class="alt ae" role="alert">${phEscape(error.message||t('pharmacy_qr_error'))}</p>`;
  }
}

function stopPharmacyQRScanner() {
  if(PH_SCAN_FRAME)cancelAnimationFrame(PH_SCAN_FRAME);
  PH_SCAN_FRAME=0;
  PH_SCAN_STREAM?.getTracks().forEach(track=>track.stop());
  PH_SCAN_STREAM=null;
  const video=$('pos-camera');
  if(video)video.srcObject=null;
  PH_SCAN_OBSERVER?.disconnect();
  PH_SCAN_OBSERVER=null;
}

async function startPharmacyQRScanner() {
  const status=$('pos-scan-status'),video=$('pos-camera');
  if(!status||!video)return;
  if(typeof BarcodeDetector!=='function') {
    status.textContent=t('pharmacy_pos_scan_unsupported');
    return;
  }
  try {
    stopPharmacyQRScanner();
    const detector=new BarcodeDetector({formats:['qr_code']});
    PH_SCAN_STREAM=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
    video.srcObject=PH_SCAN_STREAM;
    video.hidden=false;
    await video.play();
    status.textContent=t('pharmacy_pos_scan_start');
    const modal=document.getElementById('movr');
    if(typeof MutationObserver==='function'&&modal) {
      PH_SCAN_OBSERVER=new MutationObserver(()=>{if(modal.classList.contains('hid'))stopPharmacyQRScanner();});
      PH_SCAN_OBSERVER.observe(modal,{attributes:true,attributeFilter:['class']});
    }
    const scan=async()=>{
      if(!PH_SCAN_STREAM)return;
      try {
        const [result]=await detector.detect(video);
        if(result) {
          if(/^HFA-PATIENT:[0-9a-f-]{36}$/i.test(result.rawValue||'')) {
            $('pos-patient-code').value=result.rawValue;
            status.textContent=t('pharmacy_patient_qr');
          } else status.textContent=t('pharmacy_pos_scan_error');
          stopPharmacyQRScanner();
          return;
        }
      } catch(error) {
        status.textContent=t('pharmacy_pos_scan_error');
        stopPharmacyQRScanner();
        return;
      }
      PH_SCAN_FRAME=requestAnimationFrame(scan);
    };
    PH_SCAN_FRAME=requestAnimationFrame(scan);
  } catch(error) {
    stopPharmacyQRScanner();
    status.textContent=t('pharmacy_pos_scan_error');
  }
}

function showPharmacyPOS() {
  if(CU?.role!=='pharmacist')return;
  const today=new Date().toISOString().slice(0,10);
  const items=PH_DATA.items.filter(item=>item.pharmacistId===CU.id&&item.stock>0&&item.expiresOn>today);
  if(!items.length) {
    openMo(`<div class="mh"><h3 class="mt2">${t('pharmacy_pos')}</h3></div><p class="mu sm">${t('pharmacy_empty')}</p><div class="mf"><button type="button" class="btn bs" onclick="closeMo()">${t('cancel')}</button></div>`);
    return;
  }
  const productRows=items.map(item=>`<div class="pharmacy-row"><label><input type="checkbox" data-pos-select="${phEscape(item.id)}"> <strong>${phEscape(item.name)}</strong> · ${phEscape(item.strength)} · ${money(item.price,item.currency)} · ${t('pharmacy_stock')}: ${item.stock}${item.requiresPrescription?` <span class="badge bwa">${t('pharmacy_rx')}</span>`:''}</label><input class="fc" aria-label="${t('pharmacy_quantity')}" id="pos-quantity-${phEscape(item.id)}" type="number" min="1" max="${Math.min(item.stock,1000)}" step="1" value="1" disabled></div>`).join('');
  const body=`<form id="ph-pos-form">
    <p class="mu sm">${t('pharmacy_pos_scan_start')}</p><p class="mu sm">${t('pharmacy_pos_not_payment')}</p>
    ${phInput('pos-patient-code',t('pharmacy_pos_patient_code'),'text','pattern="HFA-PATIENT:[0-9a-fA-F-]{36}" autocomplete="off" maxlength="49"')}
    <button class="btn bs bsm" id="pos-start-scan" type="button">${t('pharmacy_pos_scan')}</button><video id="pos-camera" class="mt8" width="320" height="240" playsinline muted hidden></video><p class="mu sm" id="pos-scan-status" role="status"></p>
    <h4 class="ct mt12">${t('pharmacy_pos_pick_items')}</h4>${productRows}
    <label><input type="checkbox" id="pos-review-rx"> ${t('pharmacy_pos_review_rx')}</label>
    <p class="bo mt8" id="pos-total" aria-live="polite"></p><p id="ph-pos-status" role="status"></p>
    <div class="mf"><button type="button" class="btn bs" onclick="closeMo()">${t('cancel')}</button><button type="submit" class="btn bp">${t('pharmacy_pos_save')}</button></div>
  </form>`;
  openMo(`<div class="mh"><h3 class="mt2">${t('pharmacy_pos')}</h3></div>${body}`);
  const form=$('ph-pos-form');
  form.querySelectorAll('[data-pos-select]').forEach(checkbox=>checkbox.addEventListener('change',()=>{
    const quantity=$(`pos-quantity-${checkbox.dataset.posSelect}`);
    quantity.disabled=!checkbox.checked;
    updatePosTotal();
  }));
  form.querySelectorAll('[id^="pos-quantity-"]').forEach(input=>input.addEventListener('input',updatePosTotal));
  function updatePosTotal() {
    const total=items.reduce((sum,item)=>{
      const selected=form.querySelector(`[data-pos-select="${item.id}"]`)?.checked;
      return selected?sum+item.price*Number($(`pos-quantity-${item.id}`).value):sum;
    },0);
    $('pos-total').textContent=money(total,items[0]?.currency||'USD');
  }
  $('pos-start-scan').addEventListener('click',startPharmacyQRScanner);
  $('pos-patient-code').addEventListener('keydown',event=>{if(event.key==='Enter')event.preventDefault();});
  const requestId=crypto.randomUUID();
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(PH_BUSY)return;
    const patientCode=$('pos-patient-code').value.trim();
    const selected=items.filter(item=>form.querySelector(`[data-pos-select="${item.id}"]`)?.checked)
      .map(item=>({itemId:item.id,quantity:Number($(`pos-quantity-${item.id}`).value)}));
    const status=$('ph-pos-status');
    if(!/^HFA-PATIENT:[0-9a-f-]{36}$/i.test(patientCode)||!selected.length||selected.some(line=>!Number.isInteger(line.quantity)||line.quantity<1)) {
      status.textContent=t('pharmacy_pos_complete');
      return;
    }
    PH_BUSY=true;
    const submit=form.querySelector('button[type="submit"]');
    submit.disabled=true;
    try {
      await phRequest('/api/pharmacy/pos','POST',{requestId,patientCode,items:selected,prescriptionReviewed:$('pos-review-rx').checked});
      stopPharmacyQRScanner();
      closeMo();
      amsg(t('pharmacy_pos_saved'),'s');
      navigate('pharmacy');
    } catch(error) {
      status.textContent=error.message||t('pharmacy_unavailable');
    } finally {
      PH_BUSY=false;
      if(submit.isConnected)submit.disabled=false;
    }
  });
}

function showPharmacyItem() {
  if (CU?.role!=='pharmacist') return;
  const xaf=priceCurrency()==='XAF';
  phForm(t('pharmacy_add'),phInput('pi-name',t('pharmacy_medication'),'text','maxlength="200"')+phInput('pi-strength',t('pharmacy_strength'),'text','maxlength="200"')+phInput('pi-unit',t('pharmacy_unit'),'text','maxlength="200"')+phInput('pi-batch',t('pharmacy_batch'),'text','maxlength="200"')+phInput('pi-expiry',t('pharmacy_expiry'),'date')+phInput('pi-stock',t('pharmacy_stock'),'number','min="0" max="100000" step="1"')+phInput('pi-price',`${t('pharmacy_price')} (${priceCurrency()})`,'number',xaf?'min="6" max="6000000" step="6"':'min="0.01" max="10000" step="0.01"')+`<label><input id="pi-rx" type="checkbox" checked> ${t('pharmacy_rx')}</label>`,()=>phRequest('/api/pharmacy/items','POST',{name:$('pi-name').value,strength:$('pi-strength').value,unit:$('pi-unit').value,batch:$('pi-batch').value,expiresOn:$('pi-expiry').value,stock:Number($('pi-stock').value),price:Math.round(Number($('pi-price').value)/(xaf?600:1)*100)/100,requiresPrescription:$('pi-rx').checked}));
}

function showPharmacyStock(id) {
  const item=PH_DATA.items.find(item=>item.id===id);if(!item||CU?.role!=='pharmacist')return;
  phForm(t('pharmacy_adjust'),phInput('pi-stock',t('pharmacy_stock'),'number',`min="0" max="100000" step="1" value="${item.stock}"`),()=>phRequest('/api/pharmacy/items/'+id,'PATCH',{stock:Number($('pi-stock').value)}));
}

function showPharmacyPurchase(id) {
  const item=PH_DATA.items.find(item=>item.id===id);if(!item||CU?.role!=='patient')return;
  const requestId=crypto.randomUUID();
  phForm(t('pharmacy_request'),`<p>${phEscape(item.name)} · ${money(item.price,item.currency)}</p><p class="mu sm">${t('pharmacy_safety')}</p>`+phInput('po-quantity',t('pharmacy_quantity'),'number',`min="1" max="${Math.min(item.stock,20)}" step="1" value="1"`)+`<p class="bo sm mb18" id="po-total" aria-live="polite"></p><div class="fg"><label class="fl" for="po-method">${t('pharmacy_method')}</label><select class="fc" id="po-method"><option value="pickup">${t('pharmacy_pickup')}</option><option value="delivery">${t('pharmacy_delivery')}</option></select></div>`+phInput('po-address',t('pharmacy_address'),'text',`maxlength="200" value="${phEscape(CU.address||item.pharmacyAddress||'')}"`),()=>phRequest('/api/pharmacy/orders','POST',{requestId,itemId:id,quantity:Number($('po-quantity').value),method:$('po-method').value,address:$('po-address').value}));
  const updateTotal=()=>{$('po-total').textContent=`${t('pharmacy_total')}: ${money(item.price*Number($('po-quantity').value),item.currency)}`;};
  $('po-quantity').addEventListener('input',updateTotal);updateTotal();
  $('ph-form').querySelector('button[type="submit"]').textContent=t('pharmacy_request');
}

function showPharmacyFulfillment(id) {
  const order=PH_DATA.orders.find(order=>order.id===id);if(!order||CU?.role!=='pharmacist')return;
  const options=order.status==='requested'?['ready','cancelled']:order.status==='ready'?(order.method==='delivery'?['dispatched','cancelled']:['completed','cancelled']):['completed'];
  phForm(t('pharmacy_update'),`<p>${phEscape(order.name)} · ${order.quantity}</p><div class="fg"><label class="fl" for="po-status">${t('status')}</label><select class="fc" id="po-status">${options.map(status=>`<option value="${status}">${t('pharmacy_'+status)}</option>`).join('')}</select></div><label><input id="po-review" type="checkbox" ${order.prescriptionReviewed?'checked':''}> ${t('pharmacy_rx_review')}</label>`,()=>phRequest('/api/pharmacy/orders/'+id,'PATCH',{status:$('po-status').value,prescriptionReviewed:$('po-review').checked}));
}

NAV.admin[2].items.push({id:'pharmacy',l:()=>t('pharmacy_admin'),i:'clip'});
const labelPharmacyEntry=()=>{
  $('lnd-pharmacist-title').textContent=t('pharmacy_portal');
  $('lnd-pharmacist-desc').textContent=LANG==='fr'?'Stock, demandes d’achat et logistique de livraison':'Medication stock, purchase requests and delivery logistics';
  $('lnd-pharmacist-access').textContent=t('i_access_portal');
};
labelPharmacyEntry();
pharmacyRegistrationFields();
if (typeof HFAOffline!=='undefined') HFAOffline.register('pharmacy',{save:()=>PH_DATA,load:value=>{PH_DATA=value;},clear:()=>{PH_DATA={items:[],orders:[],sales:[]};}});
new MutationObserver(()=>{pharmacyRegistrationFields();labelPharmacyEntry();}).observe(document.documentElement,{attributes:true,attributeFilter:['data-lang']});