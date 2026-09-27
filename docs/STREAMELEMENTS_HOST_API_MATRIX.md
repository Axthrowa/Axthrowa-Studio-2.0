# StreamElements Ana Makine (Host) API Matrisi

> Kaynak: `obs-streamelements-core` commit `c7e0f5a` — `StreamElementsApiMessageHandler.cpp` içindeki
> `API_HANDLER_BEGIN("…")` kayıtları (**208 yöntem**, `CONFIRMED_PUBLIC_SOURCE`) ve `docs/api/host/*.md`
> (60 belge, `CONFIRMED_OFFICIAL_DOCS`). Adlar yalnız envanter içindir; ürünümüze API adı, imza ya da kod alınmadı.

## Sözleşme (belgelerden)

| Konu | Davranış |
|---|---|
| Erişim | CEF panelinde `window.host.<yöntem>(...args, ResultCallback)`; çağrı, panelin enjekte edilmiş WebSocket köprüsüyle (127.0.0.1) C++ işleyicisine gider (`STREAMELEMENTS_CORE_AUDIT.md` §5) |
| Asenkron | her yöntem sonuç geri çağrısı alır; toplu çağrı modu var (`invoke-api-methods-in-batch-mode.md`) |
| Başarısızlık | ekleme/değiştirme çağrıları başarısızlıkta `null`, silme çağrıları `success: false`; "silinemez" öğe (`canRemove=false`) tüm toplu silmeyi başarısız kılar; etkin çıkış silinemez (önce devre dışı) |
| Olaylar | `window.addEventListener('hostEventName', …)`; `broadcastMessage`/`broadcastEvent` paneller arası ileti |
| Sürümleme | yöntem başına "Available since API version x.y"; kaldırılan çağrılar git geçmişinden tarihlendi (PR #159) |
| Sınırlama | paylaşımlı video kompozisyonları yayın/kayıt etkinken değiştirilemez |
| Tanı yöntemleri | `crashProgram`, `crashProgramFastFail`, `deadlockProgram` — çökme raporlama yolunu sınamak için (CORE-864) |

## Kategoriler

| Kategori | Sayı | Yöntemler |
|---|---|---|
| Uygulama / ana makine / sistem | 21 | `getStartupFlags`, `setStartupFlags`, `getHostProperties`, `getHostCapabilities`, `getAllLoadedHostModules`, `getHostReleaseGroupProperties`, `setHostReleaseGroupProperties`, `queryHostReleaseGroupUpdateAvailability`, `getSystemCPUUsageTimes`, `getSystemMemoryUsage`, `getSystemHardwareProperties`, `openFileLocationInHostFileManager`, `openDefaultBrowser`, `getUserInterfaceState`, `setUserInterfaceState`, `adviseSignedIn`, `adviseSignedOut`, `beginOnBoarding`, `completeOnBoarding`, `takeScreenshot`, `showPopupMenuAtMousePointerPosition` |
| Docklar / arayüz / diyaloglar | 33 | `showNotificationBar`, `hideNotificationBar`, `showCentralWidget`, `hideCentralWidget`, `addDockingWidget`, `removeDockingWidgetsByIds`, `getAllDockingWidgets`, `toggleDockingWidgetFloatingById`, `setDockingWidgetDimensionsById`, `setDockingWidgetPositionById`, `setDockingWidgetUrlById`, `setDockingWidgetTitleById`, `showDockingWidgetById`, `hideDockingWidgetById`, `groupDockingWidgetsPairByIds`, `insertDockingWidgetBeforeId`, `insertDockingWidgetAfterId`, `showStatusBarTemporaryMessage`, `openPopupWindow`, `showModalDialog`, `showNonModalDialog`, `getAllNonModalDialogs`, `closeNonModalDialogsByIds`, `focusNonModalDialogById`, `setNonModalDialogDimensionsById`, `setAuxiliaryMenuItems`, `getAuxiliaryMenuItems`, `setShowBuiltInMenuItems`, `getShowBuiltInMenuItems`, `showOutputPreviewTitleBar`, `hideOutputPreviewTitleBar`, `showOutputPreviewFrame`, `hideOutputPreviewFrame` |
| Tarayıcı / çerez / HTTP / mesaj / depolama | 15 | `deleteAllCookies`, `httpRequestText`, `addBrowserScopedHttpServer`, `getAllBrowserScopedHttpServers`, `removeBrowserScopedHttpServersByIds`, `sendHttpRequestResponse`, `addBackgroundWorker`, `getAllBackgroundWorkers`, `removeBackgroundWorkersByIds`, `broadcastMessage`, `broadcastEvent`, `readScopedStorageJsonItem`, `writeScopedStorageJsonItem`, `removeScopedStorageJsonItem`, `getAllScopedStorageJsonItems` |
| Sahneler | 8 | `getAllScenes`, `getCurrentScene`, `addScene`, `setCurrentSceneById`, `removeScenesByIds`, `setScenePropertiesById`, `setScenesAuxiliaryActions`, `getScenesAuxiliaryActions` |
| Sahne öğeleri / kaynaklar / dönüşüm | 41 | `addCurrentSceneItemBrowserSource`, `addSceneItemBrowserSource`, `addCurrentSceneItemGameCaptureSource`, `addSceneItemGameCaptureSource`, `addCurrentSceneItemVideoCaptureSource`, `addSceneItemVideoCaptureSource`, `addCurrentSceneItemObsNativeSource`, `addSceneItemObsNativeSource`, `addCurrentSceneItemGroup`, `addSceneItemGroup`, `getAllCurrentSceneItems`, `getAllSceneItems`, `removeCurrentSceneItemsByIds`, `removeSceneItemsByIds`, `invokeCurrentSceneItemDefaultActionById`, `invokeCurrentSceneItemDefaultContextMenuById`, `setCurrentSceneItemsAuxiliaryActions`, `getCurrentSceneItemsAuxiliaryActions`, `setCurrentSceneItemPropertiesById`, `setSceneItemPropertiesById`, `getCurrentSceneItemPropertiesById`, `getSceneItemPropertiesById`, `ungroupCurrentSceneItemGroupById`, `ungroupSceneItemGroupById`, `openSceneItemPropertiesDialogById`, `openSceneItemFiltersDialogById`, `openSceneItemInteractionDialogById`, `openSceneItemTransformEditorDialogById`, `getSceneItemRotationInViewport`, `setSceneItemRotationInViewport`, `getSceneItemBoundingBoxInViewport`, `setSceneItemPositionInViewport`, `getAllExistingVideoInputSources`, `getAllExistingAudioInputSources`, `getAllExistingInputSources`, `getInputSourceProperties`, `getAvailableInputSourceTypes`, `getAvailableVideoInputSourceTypes`, `getAvailableAudioInputSourceTypes`, `getAvailableInputSourceClasses`, `getSourceClassProperties` |
| Filtreler | 4 | `getAvailableFilterSourceTypes`, `getAvailableAudioFilterSourceTypes`, `getAvailableVideoFilterSourceTypes`, `getFilterSourceProperties` |
| Kodlayıcılar / kodlama ayarları | 11 | `getEncoderProperties`, `getAvailableEncoders`, `getAvailableVideoEncoders`, `getAvailableAudioEncoders`, `getEncodingSettings`, `setEncodingSettings`, `getAllAvailableVideoEncoderClasses`, `getAllAvailableAudioEncoderClasses`, `getAvailableAudioEncoderClassProperties`, `getAvailableVideoEncoderClassProperties`, `getCurrentContainerProperties` |
| Ana yayın / bant testi / servis | 11 | `getStreamingStatus`, `requestStreamingStart`, `requestStreamingStop`, `setStreamingStartUIHandlerProperties`, `adviseStreamingStartUIRequestAccepted`, `adviseStreamingStartUIRequestRejected`, `setStreamingSettings`, `streamingBandwidthTestBegin`, `streamingBandwidthTestEnd`, `streamingBandwidthTestGetStatus`, `getNativeStreamingServiceIntegrationStatus` |
| Çıkışlar: akış / kayıt / tekrar arabelleği | 17 | `getAllStreamingOutputs`, `addStreamingOutput`, `removeStreamingOutputsByIds`, `enableStreamingOutputsByIds`, `disableStreamingOutputsByIds`, `getAllRecordingOutputs`, `addRecordingOutput`, `removeRecordingOutputsByIds`, `enableRecordingOutputsByIds`, `disableRecordingOutputsByIds`, `triggerRecordingOutputSplitById`, `getAllReplayBufferOutputs`, `addReplayBufferOutput`, `removeReplayBufferOutputsByIds`, `enableReplayBufferOutputsByIds`, `disableReplayBufferOutputsByIds`, `triggerReplayBufferOutputSaveById` |
| Video / ses kompozisyonları (tuval) ve geçişler | 21 | `getAllVideoCompositions`, `getAllAudioCompositions`, `removeVideoCompositionsByIds`, `removeAudioCompositionsByIds`, `addVideoComposition`, `addAudioComposition`, `setVideoCompositionProperties`, `setAudioCompositionProperties`, `removeVideoCompositionViewOverlay`, `getVideoCompositionViewOverlayProperties`, `setVideoCompositionViewOverlayProperties`, `addSharedVideoComposition`, `setSharedVideoCompositionProperties`, `removeSharedVideoCompositionsByIds`, `getAllSharedVideoCompositions`, `connectVideoCompositionToSharedVideoComposition`, `disconnectVideoCompositionsFromSharedVideoCompositionsByIds`, `getVideoCompositionTransition`, `setVideoCompositionTransition`, `showVideoCompositionTransitionPropertiesDialog`, `getAvailableTransitionClasses` |
| Profiller / sahne koleksiyonları / dış sahne verisi | 10 | `getAllProfiles`, `getCurrentProfile`, `setCurrentProfile`, `getAllSceneCollections`, `getCurrentSceneCollectionProperties`, `addSceneCollection`, `setCurrentSceneCollectionById`, `getExternalSceneDataProviders`, `getExternalSceneDataSceneCollections`, `getExternalSceneDataSceneCollectionContent` |
| Kısayollar | 5 | `getAllHotkeyBindings`, `getAllManagedHotkeyBindings`, `addHotkeyBinding`, `setHotkeyBindingTriggers`, `removeHotkeyBindingById` |
| Yedekleme / toplu kaydetme | 6 | `queryUserEnvironmentBackupReferencedFiles`, `createUserEnvironmentBackupPackage`, `queryUserEnvironmentBackupPackageContent`, `restoreUserEnvironmentBackupPackageContent`, `beginDeferSaveTransaction`, `completeDeferSaveTransaction` |
| Donanım entegrasyonu (Razer) | 2 | `getAllRazerWyvrnEvents`, `setRazerWyvrnEvent` |
| Tanı / çökme testi | 3 | `crashProgram`, `crashProgramFastFail`, `deadlockProgram` |

## Bizim karşılığımız (Kontrol Düzlemi)

Bizde ana makine API'si OBS içine gömülü bir CEF köprüsü değil; panelin yerel HTTP/WS sunucusu (`127.0.0.1:8843`)
ve OBS'e obs-websocket ile bağlanan Rust istemcisi. Durum: `EXISTING` / `PARTIAL` / `MISSING` (bu tur sonunda).

| SE kategorisi | Bizde | Durum |
|---|---|---|
| Uygulama / ana makine / sistem | `/api/server`, `/api/health`; donanım/CPU ölçümü yok | PARTIAL |
| Docklar / arayüz | Kontrol Merkezi panelleri (gizle/sırala/genişlik/hazır düzen); OBS'e dock eklemiyoruz | PARTIAL (OBS içi dock bilerek yok) |
| Tarayıcı / HTTP / depolama | overlay sayfaları + ayar deposu (`/api/settings/*`) | EXISTING (farklı model) |
| Sahneler | obs-websocket: listele, geç (ana tuval); Kontrol Merkezi "Sahne & Ses" | PARTIAL (ikincil tuvalde geçiş obs-websocket'te yok) |
| Sahne öğeleri / dönüşüm | kaynak görünürlüğü, filtre aç/kapa (kısayol eylemleri) | PARTIAL |
| Filtreler | filtre aç/kapa | PARTIAL |
| Kodlayıcılar | OBS profil **okuma** (`obs_profile.rs`), politika denetimi; yazma yok | PARTIAL |
| Ana yayın / bant testi | başlat/durdur dizisi (`obs_client.rs`); bant testi yok | PARTIAL |
| Çıkışlar: akış/kayıt/tekrar | **çoklu yayın yönlendiricisi** (hedef başına bağımsız); kayıt/tekrar OBS'in kendi çıkışları | PARTIAL |
| Kompozisyonlar (tuval) | yok — ADR-002 (`STREAMING_ENGINE_DECISION.md`) | MISSING |
| Profiller / koleksiyonlar | "Ana profil" (panel ayar profilleri); OBS koleksiyon değişimi yok | PARTIAL |
| Kısayollar | küresel kısayollar + OBS eylemleri (`hotkeys.rs`) | EXISTING |
| Yedekleme | panel yedeği (dışa/içe aktarma, şifre ayıklama), `yedek-al.ps1` | EXISTING |
| Donanım entegrasyonu | yok | NOT_APPLICABLE |
| Tanı | `yya_log`, `/api/health`; çökme raporlama yok | PARTIAL |
